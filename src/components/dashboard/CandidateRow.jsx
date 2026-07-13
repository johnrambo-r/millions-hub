import { StageBadge, StatusBadge } from '../pipeline/StageBadge'

const INTERVIEW_STAGES = new Set(['L1', 'L2', 'L3', 'Client Onsite', 'HR'])

function InStageBadge({ dateStr }) {
  if (!dateStr) return <span className="text-xs text-[#999]">—</span>
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days < 7)  return <span className="text-xs text-[#666]">{days}d</span>
  if (days < 14) return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700">{days}d</span>
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700">{days}d</span>
}

const TD = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
)

export default function CandidateRow({ candidate: c, onClick }) {
  let interviewDojContent
  if (INTERVIEW_STAGES.has(c.stage)) {
    if (c.interview_date) {
      const d = new Date(c.interview_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      interviewDojContent = (
        <div>
          <span className="text-sm text-[#0F0F12]">{d}</span>
          {c.interview_time && <span className="block text-xs text-[#999]">{c.interview_time}</span>}
        </div>
      )
    } else {
      interviewDojContent = <span className="text-[#999]">—</span>
    }
  } else if (c.stage === 'Offer' || c.stage === 'Joining') {
    if (c.date_of_joining) {
      const d = new Date(c.date_of_joining).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      interviewDojContent = <span className="text-sm text-[#0F0F12]">{d}</span>
    } else {
      interviewDojContent = <span className="text-[#999]">—</span>
    }
  } else {
    interviewDojContent = <span className="text-[#999]">—</span>
  }

  return (
    <tr
      onClick={() => onClick?.(c)}
      className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors cursor-pointer last:border-0"
    >
      <TD>
        <span className="font-medium text-[#0F0F12] block truncate max-w-[150px]">{c.name ?? '—'}</span>
        <span className="text-xs text-[#999] font-mono block mt-0.5">{c.id ?? '—'}</span>
      </TD>
      <TD>
        <span className="text-xs text-[#666] block">{c.phone ?? '—'}</span>
        <span className="text-xs text-[#999] block mt-0.5 truncate max-w-[160px]">{c.email ?? '—'}</span>
      </TD>
      <TD>
        <p className="text-xs font-semibold text-[#0F0F12] truncate max-w-[180px]">
          {c.mandates?.clients?.name ?? '—'}
        </p>
        <p className="text-xs text-[#999] truncate max-w-[180px] mt-0.5">
          {c.mandates?.title ?? '—'}{c.mandates?.job_id ? ` · ${c.mandates.job_id}` : ''}
        </p>
      </TD>
      <TD><StageBadge value={c.stage} /></TD>
      <TD><StatusBadge value={c.status} /></TD>
      <TD>{interviewDojContent}</TD>
      <TD>
        <span className="font-medium text-[#0F0F12] block text-sm truncate max-w-[130px]">
          {c.linked_by_profile?.name ?? '—'}
        </span>
        <span className="text-xs text-[#999] block mt-0.5 truncate max-w-[130px]">
          {c.mandates?.am?.name ?? '—'}
        </span>
      </TD>
      <TD><InStageBadge dateStr={c.status_changed_at} /></TD>
    </tr>
  )
}
