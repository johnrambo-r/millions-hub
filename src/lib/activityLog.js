import { supabaseAdmin } from './supabaseAdmin'
import { supabase } from './supabase'

// Activity log writes must always succeed regardless of table-level RLS policies,
// so we use the service-role client. Falls back to the anon client if the key is absent.
const db = supabaseAdmin ?? supabase

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
  const { error } = await db.from('activity_log').insert(payload)
  if (error) console.error('[activityLog] insert failed:', error.message, payload)
}
