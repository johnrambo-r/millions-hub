export const QUALIFICATIONS = [
  'B.E / B.Tech', 'MBA', 'MCA', 'BCA', 'B.Sc', 'B.Com', 'Diploma', 'Other',
]

export const NOTICE_PERIODS = [
  'Immediate', '15 days', '30 days', '45 days', '60 days', '90 days', 'Serving notice',
]

export const STAGES = ['CV', 'L1', 'L2', 'L3', 'Client Onsite', 'HR', 'Offer', 'Joining']

export const STAGE_STATUS_MAP = {
  'CV': [
    'Internal Review', 'Processed - FB Pending', 'Shortlisted', 'Hold', 'No Response',
    'Internal Duplicate', 'Client Duplicate', 'Internal Reject', 'Reject', 'Hold — Closed', 'No Response — Closed',
  ],
  'L1': [
    'Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold',
    'Reject', 'No Show — Closed', 'Hold — Closed',
  ],
  'L2': [
    'Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold',
    'Reject', 'No Show — Closed', 'Hold — Closed',
  ],
  'L3': [
    'Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold',
    'Reject', 'No Show — Closed', 'Hold — Closed',
  ],
  'Client Onsite': [
    'Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold',
    'Reject', 'No Show — Closed', 'Hold — Closed',
  ],
  'HR': [
    'Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold',
    'Reject', 'No Show — Closed', 'Hold — Closed',
  ],
  'Offer': [
    'Offer Released', 'Offer Accepted',
    'Offer Declined', 'Offer Revoked',
  ],
  'Joining': [
    'Yet to Join',
    'Declined', 'Joined & Dropped',
    'Joined', 'JYTR', 'Invoice Raised',
  ],
}

// Tab placement — driven solely by mandate_candidates.status
export const ACTIVE_STATUSES = [
  'Internal Review', 'Processed - FB Pending', 'Shortlisted', 'Hold', 'No Response',
  'Scheduled', 'Schedule Pending', 'No Show',
  'Offer Released', 'Offer Accepted',
  'Yet to Join',
]

export const TALENT_POOL_STATUSES = [
  'Internal Duplicate', 'Client Duplicate', 'Internal Reject', 'Reject',
  'Hold — Closed', 'No Response — Closed', 'No Show — Closed',
  'Offer Declined', 'Offer Revoked',
  'Declined', 'Joined & Dropped',
]

export const PLACED_STATUSES = ['Joined', 'JYTR', 'Invoice Raised']

export const PASSING_YEARS = Array.from({ length: 2025 - 1985 + 1 }, (_, i) => 2025 - i)

export function getNextStageOptions(currentStage) {
  if (currentStage === 'CV') return ['L1']
  return STAGES.filter((s) => s !== currentStage)
}
