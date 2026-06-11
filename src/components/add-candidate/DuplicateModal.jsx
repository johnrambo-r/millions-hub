import { StageBadge, StatusBadge } from '../pipeline/StageBadge'
import { ACTIVE_STATUSES, PLACED_STATUSES } from '../../lib/candidateConstants'

const VISIBLE_STATUSES = new Set([...ACTIVE_STATUSES, ...PLACED_STATUSES])

function WarnIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-amber-600">
      <path d="M10 3L2 17h16L10 3z" strokeLinejoin="round" />
      <path d="M10 9v3M10 14.5v.5" strokeLinecap="round" />
    </svg>
  )
}

function ActiveMandates({ mandateCandidates }) {
  const active = (mandateCandidates ?? []).filter((mc) => VISIBLE_STATUSES.has(mc.status))
  if (active.length === 0) return <p className="text-xs text-[#999] mt-1">No active mandate assignments</p>

  return (
    <div className="mt-2 space-y-1">
      {active.map((mc) => (
        <div key={mc.mandate_id} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-[#666] truncate max-w-[140px]">{mc.mandates?.title ?? '—'}</span>
          <StageBadge value={mc.stage} />
          <StatusBadge value={mc.status} />
        </div>
      ))}
    </div>
  )
}

export default function DuplicateModal({ duplicates, submittedName, onProceed, onCancel, onUseExisting }) {
  if (!duplicates) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <WarnIcon />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#0F0F12]">Possible duplicate detected</h3>
            <p className="text-xs text-[#666] mt-1 leading-relaxed">
              {duplicates.length} existing candidate{duplicates.length > 1 ? 's' : ''}{' '}
              match{duplicates.length === 1 ? 'es' : ''} the email or phone number you entered.
              Check before proceeding.
            </p>
          </div>
        </div>

        {/* Matches */}
        <div className="mx-6 mb-5 border border-[#F0F0F4] rounded-xl overflow-hidden divide-y divide-[#F0F0F4]">
          {duplicates.map((d) => {
            const nameMismatch = submittedName &&
              d.name.trim().toLowerCase() !== submittedName.toLowerCase()

            return (
              <div key={d.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F0F12]">{d.name}</p>
                    <p className="text-xs text-[#999] mt-0.5 font-mono">{d.id}</p>
                    <p className="text-xs text-[#999] mt-0.5">{d.email} · {d.phone}</p>
                    {nameMismatch && (
                      <p className="text-xs text-amber-700 mt-1 font-medium">
                        Same contact details, different name on record
                      </p>
                    )}
                    <ActiveMandates mandateCandidates={d.mandate_candidates} />
                  </div>
                  <button
                    onClick={() => onUseExisting(d)}
                    className="shrink-0 h-8 px-3 rounded-lg border border-[#5E6AD2] text-xs font-medium text-[#5E6AD2] hover:bg-[#5E6AD2]/5 transition whitespace-nowrap"
                  >
                    Use existing profile
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-[#F0F0F4] text-sm font-medium text-[#666] hover:bg-[#FAFAFA] transition"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#5E6AD2' }}
          >
            Create new profile
          </button>
        </div>
      </div>
    </div>
  )
}
