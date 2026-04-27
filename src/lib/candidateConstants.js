export const QUALIFICATIONS = [
  'B.E / B.Tech', 'MBA', 'MCA', 'BCA', 'B.Sc', 'B.Com', 'Diploma', 'Other',
]

export const NOTICE_PERIODS = [
  'Immediate', '15 days', '30 days', '45 days', '60 days', '90 days', 'Serving notice',
]

export const STAGES = ['CV', 'L1', 'L2', 'L3', 'Client Onsite', 'HR', 'Offer', 'Joining']

export const STAGE_STATUS_MAP = {
  'CV':           ['Internal Duplicate', 'Internal Reject', 'Shortlisted', 'FB Pending', 'Hold'],
  'L1':           ['Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold', 'Reject'],
  'L2':           ['Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold', 'Reject'],
  'L3':           ['Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold', 'Reject'],
  'Client Onsite':['Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold', 'Reject'],
  'HR':           ['Scheduled', 'Shortlisted', 'FB Pending', 'No Show', 'Schedule Pending', 'Hold', 'Reject'],
  'Offer':        ['Offer Released', 'Offer Accepted', 'Offer Declined', 'Offer Revoked'],
  'Joining':      ['Yet to Join', 'Joined', 'Dropped Out', 'Joining & Dropped'],
}

export const PASSING_YEARS = Array.from({ length: 2025 - 1985 + 1 }, (_, i) => 2025 - i)
