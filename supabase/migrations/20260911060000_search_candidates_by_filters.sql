-- Advanced Search: keyword (Postgres full-text search over resume_text_tsv) + structured filters,
-- genuinely filterable (unlike Smart Search's conceptual similarity ranking -- confirmed live
-- that a "data engineer 6-10 years, Bangalore" query surfaced an out-of-range, wrong-city match
-- because semantic search ranks, it doesn't exclude). All parameters optional and combinable.
--
-- Real production current_location data (queried before writing this) showed the dominant
-- problem is case variance ("Bangalore"/"BANGALORE"/"bangalore") and sub-locality suffixes
-- ("Chennai - Tambaram"), both already solved by case-insensitive substring ILIKE -- the only
-- gap substring matching can't bridge is a genuinely different word for the same city
-- (Bangalore/Bengaluru: 139 vs 4 rows; Gurgaon/Gurugram: 2 vs 9 rows, both confirmed in data).
-- location_search_terms() below covers exactly those pairs, not an exhaustive geocoding table.
CREATE OR REPLACE FUNCTION location_search_terms(p_input text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH aliases(a, b) AS (
    VALUES
      ('bangalore', 'bengaluru'),
      ('gurgaon', 'gurugram'),
      ('mumbai', 'bombay'),
      ('chennai', 'madras'),
      ('kolkata', 'calcutta'),
      ('pondicherry', 'puducherry'),
      ('cochin', 'kochi'),
      ('trivandrum', 'thiruvananthapuram'),
      ('vizag', 'visakhapatnam')
  )
  SELECT array_agg(DISTINCT term) FROM (
    SELECT lower(p_input) AS term
    UNION
    SELECT b AS term FROM aliases WHERE lower(p_input) LIKE '%' || a || '%'
    UNION
    SELECT a AS term FROM aliases WHERE lower(p_input) LIKE '%' || b || '%'
  ) t;
$$;

-- SECURITY INVOKER, same rationale as search_candidates_by_embedding
-- (20260911020000_search_candidates_by_embedding.sql): runs under the caller's own RLS, so
-- results are scoped exactly like every other candidates query in the app -- no new visibility
-- rules to write or keep in sync. Parameters are all p_-prefixed to avoid any ambiguity against
-- column names of the same name (education, current_location, etc.) inside the query body.
--
-- Total count returned via count(*) OVER() in the same query (computed before LIMIT/OFFSET
-- apply, so it reflects the full filtered set across all pages) -- one round trip instead of a
-- separate COUNT query, so the frontend can drive pagination without a second request.
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
      OR c.resume_text_tsv @@ websearch_to_tsquery('english', p_keyword))
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
      THEN ts_rank(c.resume_text_tsv, websearch_to_tsquery('english', p_keyword))
      ELSE NULL
    END DESC NULLS LAST,
    c.created_at DESC
  LIMIT p_page_size
  OFFSET (p_page_num - 1) * p_page_size;
$$;

GRANT EXECUTE ON FUNCTION location_search_terms(text) TO authenticated;
GRANT EXECUTE ON FUNCTION search_candidates_by_filters(
  text, numeric, numeric, text, text, text, timestamptz, timestamptz, integer, integer
) TO authenticated;
