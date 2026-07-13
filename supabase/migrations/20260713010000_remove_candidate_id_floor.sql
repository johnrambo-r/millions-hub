-- Remove the MAX(candidates.id) floor from next_candidate_id().
--
-- Root cause (see id_findings.md): the GREATEST() floor recomputed
-- MAX(id) from the live `candidates` table on every call. Nothing in
-- this app ever deletes rows from `candidates` (MandatePanel only
-- deletes from `mandate_candidates`), so any row that was ever inserted
-- permanently overrode manual resets to id_year_sequences.last_seq.
--
-- id_year_sequences is now the single source of truth. A manual
-- `UPDATE id_year_sequences SET last_seq = N WHERE prefix = 'MA' AND
-- year = <year>` is sufficient to correct the counter going forward.

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
