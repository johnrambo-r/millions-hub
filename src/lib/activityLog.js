import { supabase } from './supabase'

export async function logActivity({ candidateId, mandateId, applicantId, changedBy, changeType, oldValue, newValue }) {
  const payload = {
    candidate_id: candidateId ?? null,
    mandate_id:   mandateId   ?? null,
    applicant_id: applicantId ?? null,
    changed_by:   changedBy   ?? null,
    change_type:  changeType,
    old_value:    oldValue != null ? String(oldValue) : null,
    new_value:    newValue != null ? String(newValue) : null,
  }
  const { error } = await supabase.from('activity_log').insert(payload)
  if (error) console.error('[activityLog] insert failed:', error.message, payload)
}
