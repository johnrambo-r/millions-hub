-- Replace the single expected_ctc figure with a min/max range. The old
-- expected_ctc column is kept in place (some historical reporting may still
-- reference it) but is no longer written to by the app going forward.

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS expected_ctc_min numeric,
  ADD COLUMN IF NOT EXISTS expected_ctc_max numeric;

UPDATE candidates
SET expected_ctc_min = expected_ctc,
    expected_ctc_max = expected_ctc
WHERE expected_ctc IS NOT NULL;

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
    current_ctc, ctc_breakup, expected_ctc_min, expected_ctc_max,
    notice_period, lwd, dob, offers_in_hand,
    linkedin_url, languages_known, reason_for_looking, source, comments
  )
  VALUES (
    next_candidate_id(), v_rec.recruiter_id,
    v_rec.name, v_rec.email, v_rec.phone, v_rec.alt_contact,
    v_rec.current_location, v_rec.hometown, v_rec.preferred_location, v_rec.willing_to_relocate,
    v_rec.current_company, v_rec.skill_role, v_rec.emp_mode, v_rec.payroll_company,
    v_rec.total_exp, v_rec.relevant_exp, v_rec.education, v_rec.year_of_passing,
    v_rec.current_ctc, v_rec.ctc_breakup, v_rec.expected_ctc_min, v_rec.expected_ctc_max,
    v_rec.notice_period, v_rec.lwd, v_rec.dob, v_rec.offers_in_hand,
    v_rec.linkedin_url, v_rec.languages_known, v_rec.reason_for_looking, v_rec.source, v_rec.comments
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_candidate(jsonb) TO authenticated;
