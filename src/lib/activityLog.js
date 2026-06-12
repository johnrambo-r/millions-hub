import { supabase } from './supabase'

export async function logActivity({ candidateId, mandateId, applicantId, changedBy, changeType, oldValue, newValue }) {
  const { error } = await supabase.from('activity_log').insert({
    candidate_id: candidateId ?? null,
    mandate_id: mandateId ?? null,
    applicant_id: applicantId ?? null,
    changed_by: changedBy ?? null,
    change_type: changeType,
    old_value: oldValue != null ? String(oldValue) : null,
    new_value: newValue != null ? String(newValue) : null,
  })
  if (error) console.error('Activity log error:', error.message)
}
