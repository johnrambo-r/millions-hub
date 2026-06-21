const STAGE_STYLES = {
  'CV':                  'bg-gray-100 text-gray-700',
  'Pre-L1 Assessment':   'bg-slate-100 text-slate-600',
  'Post-L1 Assessment':  'bg-slate-100 text-slate-600',
  'L1':                  'bg-indigo-50 text-indigo-700',
  'L2':            'bg-indigo-100 text-indigo-800',
  'L3':            'bg-violet-100 text-violet-800',
  'Client Onsite': 'bg-purple-100 text-purple-800',
  'HR':            'bg-amber-100 text-amber-800',
  'Offer':         'bg-blue-100 text-blue-800',
  'Joining':       'bg-emerald-100 text-emerald-800',
}

// Talent pool / closed statuses render in muted red
const TALENT_POOL_SET = new Set([
  'Internal Reject', 'Internal Duplicate', 'Client Duplicate', 'Reject',
  'Hold — Closed', 'No Response — Closed', 'No Show — Closed',
  'Offer Declined', 'Offer Revoked',
  'Declined', 'Joined & Dropped',
])

const STATUS_STYLES = {
  'Internal Review':        'bg-slate-100 text-slate-600',
  'Processed - FB Pending': 'bg-amber-50 text-amber-700',
  'Shortlisted':            'bg-green-50 text-green-700',
  'FB Pending':             'bg-amber-50 text-amber-700',
  'Hold':             'bg-yellow-50 text-yellow-700',
  'No Response':      'bg-gray-50 text-gray-600',
  'Scheduled':        'bg-indigo-50 text-indigo-700',
  'Cleared':          'bg-green-50 text-green-700',
  'Schedule Pending': 'bg-sky-50 text-sky-700',
  'No Show':          'bg-orange-50 text-orange-700',
  'Offer Released':   'bg-blue-50 text-blue-700',
  'Offer Accepted':   'bg-emerald-50 text-emerald-700',
  'Yet to Join':      'bg-teal-50 text-teal-700',
  'Joined':           'bg-emerald-100 text-emerald-800',
  'JYTR':             'bg-emerald-50 text-emerald-700',
  'Invoice Raised':   'bg-blue-100 text-blue-800',
}

const BASE = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap'

export function StageBadge({ value }) {
  const cls = STAGE_STYLES[value] ?? 'bg-gray-100 text-gray-600'
  return <span className={`${BASE} ${cls}`}>{value ?? '—'}</span>
}

export function StatusBadge({ value }) {
  const cls = TALENT_POOL_SET.has(value)
    ? 'bg-red-50 text-red-700'
    : (STATUS_STYLES[value] ?? 'bg-gray-100 text-gray-600')
  return <span className={`${BASE} ${cls}`}>{value ?? '—'}</span>
}
