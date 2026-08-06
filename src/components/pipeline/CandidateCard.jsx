import { StageBadge, StatusBadge } from './StageBadge'

// View-only stacked card for phone-width screens. Desktop keeps the
// existing <table> layout; this is only ever rendered inside a
// `md:hidden` wrapper alongside it.
export default function CandidateCard({ onClick, applicantId, name, meta, stage, status, detailLines, aging, rowBg = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-[#F0F0F4] active:bg-[#F5F5F8] transition-colors ${rowBg}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-[#0F0F12] text-sm truncate">{name ?? '—'}</p>
          {applicantId && <p className="text-xs text-[#999] font-mono mt-0.5 truncate">{applicantId}</p>}
        </div>
        {aging && <div className="shrink-0">{aging}</div>}
      </div>

      {meta && <p className="text-xs text-[#666] mt-1.5 truncate">{meta}</p>}

      {(stage || status) && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {stage && <StageBadge value={stage} />}
          {status && <StatusBadge value={status} />}
        </div>
      )}

      {detailLines?.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {detailLines.map((line, i) => (
            <p key={i} className="text-xs text-[#999] truncate">{line}</p>
          ))}
        </div>
      )}
    </button>
  )
}
