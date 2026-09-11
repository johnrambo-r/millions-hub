-- Vector similarity search over candidates.embedding, used by the search-candidates Edge
-- Function (which embeds the recruiter's natural-language query text via OpenAI, then calls this
-- function with the resulting vector).
--
-- SECURITY INVOKER (the default, stated explicitly) -- deliberately NOT SECURITY DEFINER. This
-- function must run under the calling user's own row-level security, so semantic search results
-- are scoped to exactly the same candidates that user could already see via a normal
-- `.from('candidates').select()` call (e.g. the "All" tab in Pipeline.jsx). Piggybacking on
-- existing RLS this way means no new visibility rules need to be written or kept in sync with the
-- app's real access rules.

CREATE OR REPLACE FUNCTION search_candidates_by_embedding(
  query_embedding vector(1536),
  match_count     integer DEFAULT 20
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
  similarity        double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    id, name, email, phone, current_location, skill_role, current_company, total_exp, resume_url,
    1 - (embedding <=> query_embedding) AS similarity
  FROM candidates
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION search_candidates_by_embedding(vector(1536), integer) TO authenticated;
