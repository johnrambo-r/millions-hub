-- Backstop for the resume-upload race condition fixed on the frontend in the
-- same change: AddCandidate.jsx now uploads the resume the moment a file is
-- selected (not at submit time) and blocks Submit until that upload returns
-- a confirmed URL, which is what gets included in the create_candidate()
-- payload below. This migration makes that requirement a server-side rule
-- too, so no future version of this same race -- frontend or otherwise --
-- can create a candidate without a resume reference.
--
-- resume_url used to be deliberately excluded from this function's INSERT
-- (see 20260713020000_atomic_candidate_insert.sql) and set in a follow-up
-- UPDATE once the resume had been uploaded under the newly-issued candidate
-- ID, with the comment noting the app's "existing tolerance for a failed
-- resume upload -- that failure already does not block candidate creation."
-- That tolerance is exactly the bug being fixed here, so it no longer
-- applies: resume_url is now required at insert time, sourced straight from
-- the payload (the frontend already has a real, pre-uploaded URL in hand
-- before it ever calls this function).
--
-- Not added as a table-level NOT NULL/CHECK constraint: existing candidates
-- created before this fix may have a null resume_url, and a table-level
-- constraint would fail immediately against that historical data. Scoping
-- the guard to this function matches the ask ("reject candidate creation
-- if no valid resume reference is present") without a backfill this change
-- doesn't call for, and create_candidate() is the only path the app uses to
-- create a candidate (confirmed: no other `.from('candidates').insert(...)`
-- call site exists).

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

  IF v_rec.resume_url IS NULL OR btrim(v_rec.resume_url) = '' THEN
    RAISE EXCEPTION 'resume_url is required to create a candidate'
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  INSERT INTO candidates (
    id, recruiter_id,
    name, email, phone, alt_contact,
    current_location, hometown, preferred_location, willing_to_relocate,
    current_company, skill_role, emp_mode, payroll_company,
    total_exp, relevant_exp, education, year_of_passing,
    current_ctc, ctc_breakup, expected_ctc_min, expected_ctc_max,
    notice_period, lwd, dob, offers_in_hand,
    linkedin_url, languages_known, reason_for_looking, source, comments,
    resume_url
  )
  VALUES (
    next_candidate_id(), v_rec.recruiter_id,
    v_rec.name, v_rec.email, v_rec.phone, v_rec.alt_contact,
    v_rec.current_location, v_rec.hometown, v_rec.preferred_location, v_rec.willing_to_relocate,
    v_rec.current_company, v_rec.skill_role, v_rec.emp_mode, v_rec.payroll_company,
    v_rec.total_exp, v_rec.relevant_exp, v_rec.education, v_rec.year_of_passing,
    v_rec.current_ctc, v_rec.ctc_breakup, v_rec.expected_ctc_min, v_rec.expected_ctc_max,
    v_rec.notice_period, v_rec.lwd, v_rec.dob, v_rec.offers_in_hand,
    v_rec.linkedin_url, v_rec.languages_known, v_rec.reason_for_looking, v_rec.source, v_rec.comments,
    v_rec.resume_url
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_candidate(jsonb) TO authenticated;
