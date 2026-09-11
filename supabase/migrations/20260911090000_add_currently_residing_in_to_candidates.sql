-- "Currently residing in" captures where a candidate is physically based right
-- now, for interview scheduling. current_location/hometown/preferred_location
-- can't answer this: a candidate can be WFH from their hometown, or WFH/office
-- from a rented place in their current_location city, and those three fields
-- alone can't distinguish either case.
--
-- Nullable, no CHECK-enforced default, no backfill: every one of the ~500+
-- existing candidates gets NULL here and stays that way until a recruiter
-- deliberately fills it in while editing that record. Mandatory-on-Add /
-- optional-on-Edit is enforced entirely at the application layer (Add's
-- client-side validate(), no equivalent check in Edit's save path) --
-- consistent with how every other per-candidate field in this table already
-- has no DB-level required/NOT NULL constraint tying it to a specific flow.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS currently_residing_in text,
  ADD COLUMN IF NOT EXISTS currently_residing_in_other text;

-- Same enum-via-CHECK pattern as extraction_status/embedding_status
-- (20260911000000_add_resume_search_columns_to_candidates.sql) -- the three
-- pill options, kept in sync with CURRENTLY_RESIDING_OPTIONS in
-- src/lib/candidateConstants.js. NULL is allowed (no backfill / not required
-- on Edit), so this only rejects an out-of-set value, not an absent one.
ALTER TABLE candidates
  ADD CONSTRAINT candidates_currently_residing_in_check
    CHECK (currently_residing_in IS NULL OR currently_residing_in IN ('current_location', 'hometown', 'other'));

-- Re-declare create_candidate() (same signature/body as
-- 20260911030000_trigger_resume_extraction_on_candidate_insert.sql) with the
-- two new columns added to the explicit INSERT column/value lists --
-- jsonb_populate_record() alone won't get a new column into the row, since
-- the INSERT below names its columns explicitly rather than using v_rec.*.
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
    currently_residing_in, currently_residing_in_other,
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
    v_rec.currently_residing_in, v_rec.currently_residing_in_other,
    v_rec.current_company, v_rec.skill_role, v_rec.emp_mode, v_rec.payroll_company,
    v_rec.total_exp, v_rec.relevant_exp, v_rec.education, v_rec.year_of_passing,
    v_rec.current_ctc, v_rec.ctc_breakup, v_rec.expected_ctc_min, v_rec.expected_ctc_max,
    v_rec.notice_period, v_rec.lwd, v_rec.dob, v_rec.offers_in_hand,
    v_rec.linkedin_url, v_rec.languages_known, v_rec.reason_for_looking, v_rec.source, v_rec.comments,
    v_rec.resume_url
  )
  RETURNING * INTO v_row;

  PERFORM net.http_post(
    url     := (SELECT value FROM public.hub_settings WHERE key = 'supabase_url')
               || '/functions/v1/extract-resume',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.hub_settings WHERE key = 'service_role_key')
    ),
    body    := jsonb_build_object('candidate_id', v_row.id)
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_candidate(jsonb) TO authenticated;
