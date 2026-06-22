-- Fix: candidate ID generation race / RLS blind-spot
--
-- Root cause: useNextCandidateId reads max(candidates.id) through the caller's
-- RLS session. If RLS restricts row visibility (e.g. recruiter sees only their
-- own candidates), the hook computes a stale max and can generate an ID already
-- claimed by another user's row → duplicate-key error.
--
-- Fix: server-side SECURITY DEFINER function that (a) bypasses RLS to see all
-- rows, and (b) drives from id_year_sequences so concurrent callers can't race.

-- Step 1: seed the MA sequence from the real current max in candidates
-- (this migration runs as the superuser, so RLS does not apply here)
INSERT INTO id_year_sequences (prefix, year, last_seq)
SELECT
  'MA'                                             AS prefix,
  EXTRACT(YEAR FROM CURRENT_DATE)::int             AS year,
  COALESCE(
    MAX(SPLIT_PART(id, '-', 3)::int),
    0
  )                                                AS last_seq
FROM   candidates
WHERE  id LIKE 'MA-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-%'
  AND  SPLIT_PART(id, '-', 3) ~ '^\d+$'
ON CONFLICT (prefix, year) DO UPDATE
  SET last_seq = GREATEST(id_year_sequences.last_seq, EXCLUDED.last_seq);

-- Step 2: atomic ID generator
-- SECURITY DEFINER → runs as the function owner (superuser), bypasses RLS.
-- INSERT … ON CONFLICT DO UPDATE is atomic; concurrent calls serialize on the row lock.
CREATE OR REPLACE FUNCTION next_candidate_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_seq  int;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;

  INSERT INTO id_year_sequences (prefix, year, last_seq)
  VALUES ('MA', v_year, 1)
  ON CONFLICT (prefix, year) DO UPDATE
    SET last_seq = id_year_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'MA-' || v_year::text || '-' || LPAD(v_seq::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_candidate_id() TO authenticated;
