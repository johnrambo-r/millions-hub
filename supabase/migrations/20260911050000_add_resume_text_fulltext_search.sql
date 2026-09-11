-- Full-text search support for Advanced Search (keyword + structured filters), a second search
-- mode alongside the existing pgvector-based Smart Search (search_candidates_by_embedding).
-- Smart Search is conceptual/similarity-ranked; this is for genuinely filterable queries
-- ("data engineer, 6-10 years, Bangalore" should actually exclude non-matches, not just rank
-- them lower) -- confirmed live that semantic search alone can't guarantee that.
--
-- GENERATED ALWAYS AS ... STORED (not a bare expression index on to_tsvector(resume_text)):
-- self-maintaining on every INSERT/UPDATE of resume_text with no trigger to write or keep in
-- sync, and search_candidates_by_filters()'s WHERE clause stays a simple
-- `resume_text_tsv @@ query` instead of needing to repeat the exact to_tsvector(...) expression
-- for the planner to match it against an expression index.
--
-- coalesce(resume_text, '') so candidates with no extracted text yet (extraction_status !=
-- 'done') get an empty (not null) tsvector -- they simply never match a keyword query, same as
-- they're excluded from Smart Search by its `WHERE embedding IS NOT NULL` clause.

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS resume_text_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(resume_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_candidates_resume_text_tsv
  ON candidates USING gin(resume_text_tsv);
