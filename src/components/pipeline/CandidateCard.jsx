import { useState } from 'react'
import { StageBadge, StatusBadge } from './StageBadge'
import StageStatusSheet from './StageStatusSheet'

// Stacked card for phone-width screens. Desktop keeps the existing <table>
// layout; this is only ever rendered inside a `md:hidden` wrapper alongside
// it. Tapping the card opens the candidate panel; when stageOptions/
// statusOptions + onStageSelect/onStatusSelect are provided, the stage/status
// badges are independently tappable (own bottom sheet, doesn't also open the
// panel) — omit them to keep a badge read-only (e.g. Unassigned candidates
// have no stage/status at all). interviewButton is an optional node (an
// <InterviewTimeButton/>) rendered next to the stage badge, matching desktop's
// placement — pass null/undefined to omit it.
export default function CandidateCard({
  onClick, applicantId, name, meta, stage, status, detailLines, aging, rowBg = '',
  stageOptions, statusOptions, onStageSelect, onStatusSelect, interviewButton,
}) {
  const [sheet, setSheet] = useState(null) // 'stage' | 'status' | null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={`w-full text-left px-4 py-3 border-b border-[#F0F0F4] active:bg-[#F5F5F8] transition-colors cursor-pointer ${rowBg}`}
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
          {stage && (
            onStageSelect ? (
              <button
                type="button"
                className="active:opacity-60 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setSheet('stage') }}
              >
                <StageBadge value={stage} />
              </button>
            ) : (
              <StageBadge value={stage} />
            )
          )}
          {interviewButton}
          {status && (
            onStatusSelect && statusOptions?.length > 0 ? (
              <button
                type="button"
                className="active:opacity-60 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setSheet('status') }}
              >
                <StatusBadge value={status} />
              </button>
            ) : (
              <StatusBadge value={status} />
            )
          )}
        </div>
      )}

      {detailLines?.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {detailLines.map((line, i) => (
            <p key={i} className="text-xs text-[#999] truncate">{line}</p>
          ))}
        </div>
      )}

      {sheet === 'stage' && (
        <StageStatusSheet
          title="Stage"
          value={stage}
          options={stageOptions ?? []}
          onSelect={onStageSelect}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'status' && (
        <StageStatusSheet
          title="Status"
          value={status}
          options={statusOptions ?? []}
          onSelect={onStatusSelect}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
