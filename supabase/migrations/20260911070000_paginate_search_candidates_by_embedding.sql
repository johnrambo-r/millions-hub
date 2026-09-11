-- Adds numbered pagination to Smart Search, matching Advanced Search's
-- search_candidates_by_filters (20260911060000_search_candidates_by_filters.sql) exactly on
-- technique: p_page_num/p_page_size replace the old flat match_count, and total_count comes back
-- via count(*) OVER() in the same query (computed before LIMIT/OFFSET apply, so it reflects the
-- full similarity-ranked set across all pages) -- one round trip, no separate COUNT query.
--
-- Deliberately ADDS a new overload (3-param: query_embedding, p_page_num, p_page_size) rather
-- than dropping and replacing the existing 2-param one (query_embedding, match_count) --
-- Postgres treats different parameter signatures as distinct function objects that can coexist
-- under the same name, and PostgREST/supabase-js resolve an .rpc() call to the matching
-- overload by which named parameters are actually passed. That means the *currently-deployed*
-- search-candidates Edge Function (still calling {query_embedding, match_count}) keeps working
-- unmodified against the untouched old overload no matter when this migration lands, and only
-- switches over once it's *also* redeployed with the new parameter names -- no ordering to get
-- right between "apply migration" and "redeploy function," and no window where a search request
-- hits a parameter name that doesn't exist on either side. The old 2-param overload is safe to
-- drop in a later cleanup migration once the redeploy is confirmed stable; not done here.
--
-- Stable ordering across pages: `ORDER BY embedding <=> query_embedding` alone has no tiebreaker,
-- so two candidates at (or extremely close to) equal distance from the query could in principle
-- swap order between page fetches with no id tiebreak -- appending `, id` makes the order a total
-- order, so page N always returns the same rows in the same sequence for a given query embedding
-- and a static underlying candidate set.
--
-- What this does NOT solve (same limitation Advanced Search already has, not introduced here):
-- if a candidate is added mid-session while a recruiter is paging through results, that's a
-- genuine dataset change between two OFFSET-based page fetches, and results can shift by a
-- position the same way any OFFSET/LIMIT pagination would. Fully immune to that requires
-- cursor/keyset pagination (paginating from the last-seen similarity score + id, not a raw row
-- offset) -- a real technique, but a bigger change than asked for here, and it would make Smart
-- Search's pagination behave differently from Advanced Search's, undoing the "match exactly"
-- goal. Flagging as an accepted, shared tradeoff rather than building it silently either way.
CREATE OR REPLACE FUNCTION search_candidates_by_embedding(
  query_embedding vector(1536),
  p_page_num      integer DEFAULT 1,
  p_page_size     integer DEFAULT 20
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
  resume_url        text,
  similarity        double precision,
  total_count       bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    id, name, email, phone, current_location, skill_role, current_company, total_exp, resume_url,
    1 - (embedding <=> query_embedding) AS similarity,
    count(*) OVER() AS total_count
  FROM candidates
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding, id
  LIMIT p_page_size
  OFFSET (p_page_num - 1) * p_page_size;
$$;

GRANT EXECUTE ON FUNCTION search_candidates_by_embedding(vector(1536), integer, integer) TO authenticated;
