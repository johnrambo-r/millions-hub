// Shared interview-reminder creation logic, used by both the L1 interview
// scheduling modal and the candidate side panel so the write path is defined once.

export async function createInterviewReminder(supabaseClient, { mandateCandidateId, leadTimeMinutes, createdBy }) {
  return supabaseClient.from('interview_reminders').insert({
    mandate_candidate_id: mandateCandidateId,
    lead_time_minutes: leadTimeMinutes,
    created_by: createdBy,
  })
}

// Cancels any still-pending (not fired, not cancelled) reminder for a mandate_candidate.
// Used before creating a new one so at most one active reminder exists per interview.
export async function cancelActiveInterviewReminders(supabaseClient, mandateCandidateId) {
  return supabaseClient
    .from('interview_reminders')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('mandate_candidate_id', mandateCandidateId)
    .is('fired_at', null)
    .is('cancelled_at', null)
}
