-- Add a "hometown" field to candidates, distinct from current_location
-- (where the candidate lives now) and preferred_location (where they want
-- to work). No backfill for existing rows -- left NULL until edited.
--
-- Postgres always appends new columns physically at the end of the table
-- regardless of ADD COLUMN order, so "near current_location" is expressed
-- here in the column's logical placement within create_candidate()'s
-- explicit column/value lists rather than physical table layout.

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS hometown text;

CREATE OR REPLACE FUNCTION create_candidate(payload jsonb)
RETURNS candidates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec candidates;
  v_row candidates;
BEGIN
  v_rec := jsonb_populate_record(NULL::candidates, payload);

  INSERT INTO candidates (
    id, recruiter_id,
    name, email, phone, alt_contact,
    current_location, hometown, preferred_location, willing_to_relocate,
    current_company, skill_role, emp_mode, payroll_company,
    total_exp, relevant_exp, education, year_of_passing,
    current_ctc, ctc_breakup, expected_ctc,
    notice_period, lwd, dob, offers_in_hand,
    linkedin_url, languages_known, reason_for_looking, source, comments
  )
  VALUES (
    next_candidate_id(), v_rec.recruiter_id,
    v_rec.name, v_rec.email, v_rec.phone, v_rec.alt_contact,
    v_rec.current_location, v_rec.hometown, v_rec.preferred_location, v_rec.willing_to_relocate,
    v_rec.current_company, v_rec.skill_role, v_rec.emp_mode, v_rec.payroll_company,
    v_rec.total_exp, v_rec.relevant_exp, v_rec.education, v_rec.year_of_passing,
    v_rec.current_ctc, v_rec.ctc_breakup, v_rec.expected_ctc,
    v_rec.notice_period, v_rec.lwd, v_rec.dob, v_rec.offers_in_hand,
    v_rec.linkedin_url, v_rec.languages_known, v_rec.reason_for_looking, v_rec.source, v_rec.comments
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_candidate(jsonb) TO authenticated;
