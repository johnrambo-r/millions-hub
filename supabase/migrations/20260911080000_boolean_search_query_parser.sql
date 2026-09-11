-- Fix: Advanced Search's boolean keyword query was passed straight into
-- websearch_to_tsquery(), which has no concept of parentheses (they're
-- stripped as punctuation, not grouping) and treats OR as the LOWEST
-- precedence operator. So a query like `("c#" OR "C#.net") AND entity AND
-- azure` was silently reparsed as `c# | (c#.net & entity & azure)` -- meaning
-- a resume matching just "c#" satisfied the whole query regardless of the
-- AND-ed terms, which is exactly why adding more AND terms never changed the
-- result count.
--
-- parse_boolean_search_query() below is a real boolean-query parser: it
-- tokenizes the input (quoted phrases, parens, and case-sensitive whole-word
-- AND/OR/NOT operators), then evaluates it with standard precedence
-- (NOT > AND > OR, parens override) directly into a `tsquery` value using
-- Postgres's own &&/||/!! tsquery operators -- so grouping actually groups,
-- and there's no hand-built query string to escape.
--
-- AND/OR/NOT are recognized ONLY when they appear as exact-case uppercase
-- whole words (matched with the \M word-boundary anchor), so a real search
-- term that happens to contain "and"/"or" -- lowercase ("sales and
-- marketing"), inside a quoted phrase ("Sales AND Service" as a literal
-- company name), or as a substring/prefix of another word ("AND1", "Oracle")
-- -- is never mistaken for an operator; only a standalone uppercase AND/OR/NOT
-- token triggers boolean logic. Adjacent terms with no explicit operator are
-- implicitly AND-ed (matching prior websearch_to_tsquery behavior), and a
-- leading "-" still negates the following term, matching the "-junior"
-- exclusion syntax already advertised in the Advanced Search placeholder text.
CREATE OR REPLACE FUNCTION search_query_operator_precedence(p_op text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_op WHEN 'NOT' THEN 3 WHEN 'AND' THEN 2 WHEN 'OR' THEN 1 END
$$;

CREATE OR REPLACE FUNCTION search_query_tokenize(p_query text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_tokens text[] := '{}';
  v_rest text := p_query;
  v_ws text;
  v_phrase text;
  v_op text;
  v_word text;
BEGIN
  LOOP
    v_ws := substring(v_rest from '^\s+');
    IF v_ws IS NOT NULL THEN
      v_rest := substring(v_rest from length(v_ws) + 1);
    END IF;

    EXIT WHEN v_rest = '' OR v_rest IS NULL;

    IF left(v_rest, 1) = '(' THEN
      v_tokens := array_append(v_tokens, 'LP');
      v_rest := substring(v_rest from 2);
      CONTINUE;
    END IF;

    IF left(v_rest, 1) = ')' THEN
      v_tokens := array_append(v_tokens, 'RP');
      v_rest := substring(v_rest from 2);
      CONTINUE;
    END IF;

    IF left(v_rest, 1) = '"' THEN
      v_phrase := substring(v_rest from '^"([^"]*)"');
      IF v_phrase IS NOT NULL THEN
        v_tokens := array_append(v_tokens, ('PHR:' || v_phrase));
        v_rest := substring(v_rest from length(v_phrase) + 3);
        CONTINUE;
      END IF;
      -- unterminated quote: treat the remainder as a literal phrase
      v_tokens := array_append(v_tokens, ('PHR:' || substring(v_rest from 2)));
      v_rest := '';
      CONTINUE;
    END IF;

    -- case-sensitive whole-word operator only (\M = end-of-word boundary),
    -- so "AND1", "Android", "sales and marketing" never match here
    v_op := substring(v_rest from '^(AND|OR|NOT)\M');
    IF v_op IS NOT NULL THEN
      v_tokens := array_append(v_tokens, v_op);
      v_rest := substring(v_rest from length(v_op) + 1);
      CONTINUE;
    END IF;

    v_word := substring(v_rest from '^[^\s()"]+');
    v_tokens := array_append(v_tokens, ('WRD:' || v_word));
    v_rest := substring(v_rest from length(v_word) + 1);
  END LOOP;

  RETURN v_tokens;
END;
$$;

CREATE OR REPLACE FUNCTION parse_boolean_search_query(p_query text)
RETURNS tsquery
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_raw text[];
  v_tokens text[] := '{}';
  v_tok text;
  v_prev text;
  v_ends_value boolean;
  v_starts_value boolean;

  v_operand_stack tsquery[] := '{}';
  v_operator_stack text[] := '{}';
  v_i int;
  v_n int;
  v_op text;
  v_word text;
  v_b tsquery;
  v_a tsquery;
BEGIN
  v_raw := search_query_tokenize(p_query);
  IF v_raw IS NULL OR array_length(v_raw, 1) IS NULL THEN
    RETURN ''::tsquery;
  END IF;

  -- Pass 1: insert an implicit AND between adjacent value-producing tokens
  -- (a word, phrase, or closing paren) directly followed by another
  -- value-starting token (word, phrase, opening paren, or NOT), with no
  -- explicit operator between them.
  FOR v_i IN 1 .. array_length(v_raw, 1) LOOP
    v_tok := v_raw[v_i];
    IF v_i > 1 THEN
      v_prev := v_raw[v_i - 1];
      v_ends_value := (v_prev LIKE 'WRD:%') OR (v_prev LIKE 'PHR:%') OR (v_prev = 'RP');
      v_starts_value := (v_tok LIKE 'WRD:%') OR (v_tok LIKE 'PHR:%') OR (v_tok = 'LP') OR (v_tok = 'NOT');
      IF v_ends_value AND v_starts_value THEN
        v_tokens := array_append(v_tokens, 'AND');
      END IF;
    END IF;
    v_tokens := array_append(v_tokens, v_tok);
  END LOOP;

  -- Pass 2: shunting-yard, building actual tsquery values directly via
  -- Postgres's own &&/||/!! tsquery operators (which already treat an empty
  -- operand -- e.g. a pure-stopword term -- as a no-op when combined).
  v_n := array_length(v_tokens, 1);
  v_i := 1;
  WHILE v_i <= v_n LOOP
    v_tok := v_tokens[v_i];

    IF v_tok = 'LP' THEN
      v_operator_stack := array_append(v_operator_stack, 'LP');

    ELSIF v_tok = 'RP' THEN
      WHILE array_length(v_operator_stack, 1) > 0 AND v_operator_stack[array_length(v_operator_stack,1)] != 'LP' LOOP
        v_op := v_operator_stack[array_length(v_operator_stack,1)];
        v_operator_stack := v_operator_stack[1:array_length(v_operator_stack,1)-1];
        IF v_op = 'NOT' THEN
          v_a := v_operand_stack[array_length(v_operand_stack,1)];
          v_operand_stack := v_operand_stack[1:array_length(v_operand_stack,1)-1];
          v_operand_stack := array_append(v_operand_stack, (!! v_a));
        ELSE
          v_b := v_operand_stack[array_length(v_operand_stack,1)];
          v_a := v_operand_stack[array_length(v_operand_stack,1)-1];
          v_operand_stack := v_operand_stack[1:array_length(v_operand_stack,1)-2];
          IF v_op = 'AND' THEN
            v_operand_stack := array_append(v_operand_stack, (v_a && v_b));
          ELSE
            v_operand_stack := array_append(v_operand_stack, (v_a || v_b));
          END IF;
        END IF;
      END LOOP;
      IF array_length(v_operator_stack, 1) > 0 THEN
        v_operator_stack := v_operator_stack[1:array_length(v_operator_stack,1)-1]; -- discard 'LP'
      END IF;

    ELSIF v_tok = 'AND' OR v_tok = 'OR' OR v_tok = 'NOT' THEN
      WHILE array_length(v_operator_stack, 1) > 0
        AND v_operator_stack[array_length(v_operator_stack,1)] != 'LP'
        AND (
          search_query_operator_precedence(v_operator_stack[array_length(v_operator_stack,1)]) > search_query_operator_precedence(v_tok)
          OR (search_query_operator_precedence(v_operator_stack[array_length(v_operator_stack,1)]) = search_query_operator_precedence(v_tok) AND v_tok != 'NOT')
        )
      LOOP
        v_op := v_operator_stack[array_length(v_operator_stack,1)];
        v_operator_stack := v_operator_stack[1:array_length(v_operator_stack,1)-1];
        IF v_op = 'NOT' THEN
          v_a := v_operand_stack[array_length(v_operand_stack,1)];
          v_operand_stack := v_operand_stack[1:array_length(v_operand_stack,1)-1];
          v_operand_stack := array_append(v_operand_stack, (!! v_a));
        ELSE
          v_b := v_operand_stack[array_length(v_operand_stack,1)];
          v_a := v_operand_stack[array_length(v_operand_stack,1)-1];
          v_operand_stack := v_operand_stack[1:array_length(v_operand_stack,1)-2];
          IF v_op = 'AND' THEN
            v_operand_stack := array_append(v_operand_stack, (v_a && v_b));
          ELSE
            v_operand_stack := array_append(v_operand_stack, (v_a || v_b));
          END IF;
        END IF;
      END LOOP;
      v_operator_stack := array_append(v_operator_stack, v_tok);

    ELSIF v_tok LIKE 'PHR:%' THEN
      v_operand_stack := array_append(v_operand_stack, phraseto_tsquery('english', substring(v_tok from 5)));

    ELSIF v_tok LIKE 'WRD:%' THEN
      v_word := substring(v_tok from 5);
      IF left(v_word, 1) = '-' AND length(v_word) > 1 THEN
        v_operand_stack := array_append(v_operand_stack, (!! plainto_tsquery('english', substring(v_word from 2))));
      ELSE
        v_operand_stack := array_append(v_operand_stack, plainto_tsquery('english', v_word));
      END IF;
    END IF;

    v_i := v_i + 1;
  END LOOP;

  -- drain remaining operators (any unmatched '(' is simply discarded)
  WHILE array_length(v_operator_stack, 1) > 0 LOOP
    v_op := v_operator_stack[array_length(v_operator_stack,1)];
    v_operator_stack := v_operator_stack[1:array_length(v_operator_stack,1)-1];
    IF v_op = 'LP' THEN
      CONTINUE;
    ELSIF v_op = 'NOT' THEN
      IF array_length(v_operand_stack, 1) > 0 THEN
        v_a := v_operand_stack[array_length(v_operand_stack,1)];
        v_operand_stack := v_operand_stack[1:array_length(v_operand_stack,1)-1];
        v_operand_stack := array_append(v_operand_stack, (!! v_a));
      END IF;
    ELSE
      IF array_length(v_operand_stack, 1) >= 2 THEN
        v_b := v_operand_stack[array_length(v_operand_stack,1)];
        v_a := v_operand_stack[array_length(v_operand_stack,1)-1];
        v_operand_stack := v_operand_stack[1:array_length(v_operand_stack,1)-2];
        IF v_op = 'AND' THEN
          v_operand_stack := array_append(v_operand_stack, (v_a && v_b));
        ELSE
          v_operand_stack := array_append(v_operand_stack, (v_a || v_b));
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_operand_stack, 1) IS NULL THEN
    RETURN ''::tsquery;
  END IF;

  RETURN v_operand_stack[array_length(v_operand_stack,1)];
END;
$$;

-- Same body as 20260911060000_search_candidates_by_filters.sql, except the
-- two websearch_to_tsquery(...) calls are replaced with parse_boolean_search_query(...).
CREATE OR REPLACE FUNCTION search_candidates_by_filters(
  p_keyword      text DEFAULT NULL,
  p_exp_min      numeric DEFAULT NULL,
  p_exp_max      numeric DEFAULT NULL,
  p_location     text DEFAULT NULL,
  p_company      text DEFAULT NULL,
  p_education    text DEFAULT NULL,
  p_added_after  timestamptz DEFAULT NULL,
  p_added_before timestamptz DEFAULT NULL,
  p_page_num     integer DEFAULT 1,
  p_page_size    integer DEFAULT 20
)
RETURNS TABLE (
  id                text,
  name              text,
  email             text,
  phone             text,
  current_location  text,
  skill_role        text,
  current_company   text,
  total_exp         numeric,
  education         text,
  resume_url        text,
  created_at        timestamptz,
  total_count       bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id, c.name, c.email, c.phone, c.current_location, c.skill_role, c.current_company,
    c.total_exp, c.education, c.resume_url, c.created_at,
    count(*) OVER() AS total_count
  FROM candidates c
  WHERE
    (p_keyword IS NULL OR btrim(p_keyword) = ''
      OR c.resume_text_tsv @@ parse_boolean_search_query(p_keyword))
    AND (p_exp_min IS NULL OR c.total_exp >= p_exp_min)
    AND (p_exp_max IS NULL OR c.total_exp <= p_exp_max)
    AND (p_location IS NULL OR btrim(p_location) = '' OR EXISTS (
      SELECT 1 FROM unnest(location_search_terms(p_location)) term
      WHERE c.current_location ILIKE '%' || term || '%'
    ))
    AND (p_company IS NULL OR btrim(p_company) = ''
      OR c.current_company ILIKE '%' || p_company || '%')
    AND (p_education IS NULL OR btrim(p_education) = '' OR c.education = p_education)
    AND (p_added_after IS NULL OR c.created_at >= p_added_after)
    AND (p_added_before IS NULL OR c.created_at <= p_added_before)
  ORDER BY
    CASE WHEN p_keyword IS NOT NULL AND btrim(p_keyword) != ''
      THEN ts_rank(c.resume_text_tsv, parse_boolean_search_query(p_keyword))
      ELSE NULL
    END DESC NULLS LAST,
    c.created_at DESC
  LIMIT p_page_size
  OFFSET (p_page_num - 1) * p_page_size;
$$;

GRANT EXECUTE ON FUNCTION search_query_operator_precedence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION search_query_tokenize(text) TO authenticated;
GRANT EXECUTE ON FUNCTION parse_boolean_search_query(text) TO authenticated;
