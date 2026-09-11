-- Adds resume text extraction + embedding state to candidates, purely additive
-- (ALTER TABLE ADD COLUMN only -- same shape as 20260805000000_add_hometown_to_candidates.sql
-- and 20260806000000_add_expected_ctc_range_to_candidates.sql). No RLS changes: existing
-- row-level policies on candidates already govern every column on the row, including these.
--
-- Deliberately NOT added to the app's CANDIDATE_FIELDS select (src/pages/Pipeline.jsx) or any
-- other existing query -- resume_text and embedding are large payloads that no current page
-- needs, and pulling them into every candidates fetch would slow down screens that have nothing
-- to do with search.
--
-- Two independent status columns (extraction_status, embedding_status) rather than one combined
-- field: extraction and embedding are separate failure domains (a corrupt PDF fails extraction
-- before an embedding is ever attempted; a healthy extraction can still fail embedding on a
-- transient OpenAI error). Each gets its own error text + attempt counter so failures are visible
-- and retryable per-stage, instead of the silent-miss pattern in the interview reminder job (which
-- has no per-item status at all).
--
-- The vector extension is enabled here (not in the later HNSW-index migration) because the
-- `embedding` column's type declaration below requires it to already exist.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS resume_text        text,
  ADD COLUMN IF NOT EXISTS extraction_status   text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extraction_error    text,
  ADD COLUMN IF NOT EXISTS extraction_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extracted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS embedding           vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_status    text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embedding_error     text,
  ADD COLUMN IF NOT EXISTS embedding_attempts  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedded_at         timestamptz;

ALTER TABLE candidates
  ADD CONSTRAINT candidates_extraction_status_check
    CHECK (extraction_status IN ('pending', 'done', 'failed')),
  ADD CONSTRAINT candidates_embedding_status_check
    CHECK (embedding_status IN ('pending', 'done', 'failed'));

-- Lets the extraction/embedding sweeps find work without a sequential scan of the whole table.
CREATE INDEX IF NOT EXISTS idx_candidates_extraction_status
  ON candidates (extraction_status) WHERE extraction_status != 'done';
CREATE INDEX IF NOT EXISTS idx_candidates_embedding_status
  ON candidates (embedding_status) WHERE embedding_status != 'done';
