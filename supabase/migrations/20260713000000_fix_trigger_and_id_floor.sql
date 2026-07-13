-- Fix 1: log_status_change() on candidates references column `stage` which
-- does not exist on candidates (stage lives on mandate_candidates). Rewrite to
-- track the candidate-profile fields that actually represent availability/status.

CREATE OR REPLACE FUNCTION log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.notice_period IS DISTINCT FROM NEW.notice_period THEN
    INSERT INTO activity_log (candidate_id, change_type, old_value, new_value)
    VALUES (NEW.id, 'notice_period', OLD.notice_period::text, NEW.notice_period::text);
  END IF;

  IF OLD.lwd IS DISTINCT FROM NEW.lwd THEN
    INSERT INTO activity_log (candidate_id, change_type, old_value, new_value)
    VALUES (NEW.id, 'lwd', OLD.lwd::text, NEW.lwd::text);
  END IF;

  IF OLD.current_company IS DISTINCT FROM NEW.current_company THEN
    INSERT INTO activity_log (candidate_id, change_type, old_value, new_value)
    VALUES (NEW.id, 'current_company', OLD.current_company, NEW.current_company);
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger (drop first in case it already exists with a bad body)
DROP TRIGGER IF EXISTS log_status_change ON public.candidates;

CREATE TRIGGER log_status_change
AFTER UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION log_status_change();


-- Fix 2: next_candidate_id() should floor against the highest existing candidate
-- ID so that resetting id_year_sequences (or any external gap) can't produce an
-- ID that collides with or falls below what is already in the candidates table.

CREATE OR REPLACE FUNCTION next_candidate_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year    int;
  v_seq     int;
  v_max_seq int;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;

  -- Highest ID already in candidates for this year (bypasses RLS via SECURITY DEFINER)
  SELECT COALESCE(MAX(SPLIT_PART(id, '-', 3)::int), 0)
  INTO   v_max_seq
  FROM   candidates
  WHERE  id LIKE 'MA-' || v_year::text || '-%'
    AND  SPLIT_PART(id, '-', 3) ~ '^\d+$';

  -- Atomically advance the counter to the greater of (counter+1) and (max_existing+1).
  -- EXCLUDED.last_seq = GREATEST(v_max_seq+1, 1) is the candidate-based floor;
  -- the DO UPDATE takes whichever is higher so neither the sequence nor the table
  -- can produce a duplicate or a regression.
  INSERT INTO id_year_sequences (prefix, year, last_seq)
  VALUES ('MA', v_year, GREATEST(v_max_seq + 1, 1))
  ON CONFLICT (prefix, year) DO UPDATE
    SET last_seq = GREATEST(id_year_sequences.last_seq + 1, EXCLUDED.last_seq)
  RETURNING last_seq INTO v_seq;

  RETURN 'MA-' || v_year::text || '-' || LPAD(v_seq::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_candidate_id() TO authenticated;
