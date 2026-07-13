-- Wrap next_candidate_id() and the candidates insert in one transaction.
--
-- Before this migration, AddCandidate.jsx called next_candidate_id() (one
-- round trip) and then supabase.from('candidates').insert(...) (a second,
-- separate round trip), with a resume upload in between. If the insert
-- failed for any reason after the ID had already been generated -- a
-- constraint violation, a dropped connection, an RLS denial -- the sequence
-- number was already burned in id_year_sequences with no candidate row to
-- show for it. That is a distinct issue from the earlier "ID generated at
-- mount time" bug fixed in 20260713010000_remove_candidate_id_floor.sql:
-- this one can burn a number even when the ID is generated at the correct
-- point in the flow, simply because generation and insert were not atomic.
--
-- create_candidate() generates the ID and performs the insert inside a
-- single PL/pgSQL function body, so they run in one transaction: if the
-- INSERT fails, the whole function aborts and the id_year_sequences
-- increment rolls back with it. No candidate row saved => no number burned.
--
-- jsonb_populate_record(NULL::candidates, payload) is used instead of
-- hand-written column casts so that every field is coerced using the real
-- column types from the catalog, without needing to know them in advance.
-- The explicit column list below excludes `id` (assigned from
-- next_candidate_id(), not the caller) and `resume_url` (set in a
-- follow-up UPDATE once the resume has been uploaded to storage under the
-- newly-issued candidate ID, mirroring the app's existing tolerance for a
-- failed resume upload -- that failure already does not block candidate
-- creation, so it must not participate in this transaction either).

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
    current_location, preferred_location, willing_to_relocate,
    current_company, skill_role, emp_mode, payroll_company,
    total_exp, relevant_exp, education, year_of_passing,
    current_ctc, ctc_breakup, expected_ctc,
    notice_period, lwd, dob, offers_in_hand,
    linkedin_url, languages_known, reason_for_looking, source, comments
  )
  VALUES (
    next_candidate_id(), v_rec.recruiter_id,
    v_rec.name, v_rec.email, v_rec.phone, v_rec.alt_contact,
    v_rec.current_location, v_rec.preferred_location, v_rec.willing_to_relocate,
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
