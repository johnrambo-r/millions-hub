import { supabase } from './supabase'
import { logActivity } from './activityLog'
import { STAGE_STATUS_MAP, INTERVIEW_STAGES } from './candidateConstants'

// Shared stage/status mutation logic — the single source of truth reused by
// desktop (Pipeline table rows, CandidatePanel) and mobile (candidate cards,
// CandidatePanel) so the write path and activity-log entries are always
// identical regardless of which surface triggered the change.

export async function changeStage({ mcId, candidateId, mandateId, applicantId, oldStage, oldStatus, newStage, changedBy }) {
  const newStatus = STAGE_STATUS_MAP[newStage]?.[0] ?? null

  await supabase.from('mandate_candidates')
    .update({ stage: newStage, status: newStatus, status_changed_at: new Date().toISOString() })
    .eq('id', mcId)

  await logActivity({ candidateId, mandateId, applicantId, changedBy, changeType: 'stage', oldValue: oldStage, newValue: newStage })
  if (oldStatus !== newStatus) {
    await logActivity({ candidateId, mandateId, applicantId, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
  }

  return newStatus
}

export async function changeStatus({ mcId, candidateId, mandateId, applicantId, oldStatus, newStatus, changedBy }) {
  await supabase.from('mandate_candidates').update({ status: newStatus, status_changed_at: new Date().toISOString() }).eq('id', mcId)
  await logActivity({ candidateId, mandateId, applicantId, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
}

// Which supplementary-detail prompt (if any) a stage/status transition opens.
export function promptTypeForStage(newStage) {
  if (newStage === 'Pre-L1 Assessment' || newStage === 'Post-L1 Assessment') return 'assessment'
  if (INTERVIEW_STAGES.has(newStage)) return 'interview'
  if (newStage === 'Offer') return 'offer'
  if (newStage === 'Joining') return 'joining'
  return null
}

export function promptTypeForStatus(newStatus) {
  return newStatus === 'Invoice Raised' ? 'invoice' : null
}
