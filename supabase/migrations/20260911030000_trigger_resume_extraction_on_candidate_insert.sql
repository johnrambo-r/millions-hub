-- Kicks off resume text extraction the moment a candidate is created, without adding any
-- latency to the recruiter's submit call: net.http_post (pg_net) queues the HTTP request and
-- returns immediately -- the same non-blocking mechanism already relied on for interview
-- reminders (20260623000002_zoho_bot_and_cron.sql) -- so the RETURN below still happens on the
-- very next line, well before the extract-resume Edge Function has actually run.
--
-- Every existing column, validation (including the resume_url NOT NULL check), and the RETURNS
-- candidates contract of create_candidate() from 20260806010000_require_resume_url_on_candidate_insert.sql
-- is preserved unchanged -- the only addition is the net.http_post call appended just before
-- RETURN.

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

  -- Fire-and-forget: kick off text extraction for the new candidate. Async by construction
  -- (net.http_post queues the request via pg_net's background worker), so this never blocks or
  -- slows down the caller's response.
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

-- Periodic sweeps: catch anything the live best-effort path missed. Same cron -> pg_net ->
-- Edge Function shape as fire-interview-reminders; each call with an empty body puts the target
-- function into sweep mode (see the two functions' own comments for exactly which rows that
-- picks up and the retry ceiling).
--
-- Two separate jobs, not one, because extraction and embedding are independent failure domains
-- with independent retry state (extraction_attempts vs embedding_attempts) -- a candidate stuck
-- on a transient embedding failure shouldn't cause its (already-successful) extraction to be
-- re-attempted, and vice versa.
SELECT cron.schedule(
  'sweep-pending-candidate-extractions',
  '*/15 * * * *',
  $cron_body$
    SELECT net.http_post(
      url     := (SELECT value FROM public.hub_settings WHERE key = 'supabase_url')
                 || '/functions/v1/extract-resume',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.hub_settings WHERE key = 'service_role_key')
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $cron_body$
);

SELECT cron.schedule(
  'sweep-pending-candidate-embeddings',
  '*/15 * * * *',
  $cron_body$
    SELECT net.http_post(
      url     := (SELECT value FROM public.hub_settings WHERE key = 'supabase_url')
                 || '/functions/v1/embed-resume',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.hub_settings WHERE key = 'service_role_key')
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $cron_body$
);
