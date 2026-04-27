const STAGE_STYLES = {
  'CV':            'bg-gray-100 text-gray-700',
  'L1':            'bg-indigo-50 text-indigo-700',
  'L2':            'bg-indigo-100 text-indigo-800',
  'L3':            'bg-violet-100 text-violet-800',
  'Client Onsite': 'bg-purple-100 text-purple-800',
  'HR':            'bg-amber-100 text-amber-800',
  'Offer':         'bg-blue-100 text-blue-800',
  'Joining':       'bg-emerald-100 text-emerald-800',
}

const DEAD_STATUSES = new Set([
  'Internal Reject', 'Internal Duplicate', 'Reject',
  'Offer Declined', 'Offer Revoked', 'Dropped Out', 'Joining & Dropped',
])

const STATUS_STYLES = {
  'FB Pending': 'bg-amber-50 text-amber-700',
  'Scheduled':  'bg-indigo-50 text-indigo-700',
  'Cleared':    'bg-emerald-50 text-emerald-700',
  'Hold':       'bg-yellow-50 text-yellow-700',
  'Offer Made': 'bg-blue-50 text-blue-800',
  'Joined':     'bg-emerald-100 text-emerald-800',
}

const BASE = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap'

export function StageBadge({ value }) {
  const cls = STAGE_STYLES[value] ?? 'bg-gray-100 text-gray-600'
  return <span className={`${BASE} ${cls}`}>{value ?? '—'}</span>
}

export function StatusBadge({ value }) {
  const cls = DEAD_STATUSES.has(value)
    ? 'bg-red-50 text-red-700'
    : (STATUS_STYLES[value] ?? 'bg-gray-100 text-gray-600')
  return <span className={`${BASE} ${cls}`}>{value ?? '—'}</span>
}
