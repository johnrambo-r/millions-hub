-- HNSW index for cosine-similarity search over candidates.embedding, added by
-- 20260911000000_add_resume_search_columns_to_candidates.sql (which also enables the vector
-- extension that this index type depends on).
--
-- Plain CREATE INDEX (not CONCURRENTLY): at current candidate volumes (~600 rows, growing slowly)
-- this completes in well under a second, and a migration file runs inside a transaction anyway --
-- CREATE INDEX CONCURRENTLY cannot run inside one, so using it here would require pulling this
-- statement out of the normal migration flow for no real benefit at this table size. Revisit if
-- candidate volume grows enough that the brief lock becomes noticeable.

CREATE INDEX IF NOT EXISTS idx_candidates_embedding_hnsw
  ON candidates
  USING hnsw (embedding vector_cosine_ops);
