import { useEffect, useRef, useState } from 'react'

// ─── StagePromptModal ────────────────────────────────────────────────────────
// Shown after a stage change to capture optional interview/offer/joining details.

export function StagePromptModal({ type, mcId, supabaseClient, onClose }) {
  const [saving, setSaving] = useState(false)
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewTime, setInterviewTime] = useState('')
  const [offeredCtc, setOfferedCtc] = useState('')
  const [billingAmount, setBillingAmount] = useState('')
  const [dateOfJoining, setDateOfJoining] = useState('')

  const title =
    type === 'interview' ? 'Interview Details' :
    type === 'offer'     ? 'Offer Details' :
    'Joining Details'

  async function handleSave() {
    const updates = {}
    if (type === 'interview') {
      if (interviewDate) updates.interview_date = interviewDate
      if (interviewTime) updates.interview_time = interviewTime
    } else if (type === 'offer') {
      if (offeredCtc)     updates.offered_ctc           = parseFloat(offeredCtc)
      if (billingAmount)  updates.billing_value_approx  = parseFloat(billingAmount)
      if (dateOfJoining)  updates.date_of_joining       = dateOfJoining
    } else if (type === 'joining') {
      if (billingAmount)  updates.billing_value_approx  = parseFloat(billingAmount)
      if (dateOfJoining)  updates.date_of_joining       = dateOfJoining
    }

    if (Object.keys(updates).length > 0) {
      setSaving(true)
      await supabaseClient.from('mandate_candidates').update(updates).eq('id', mcId)
      setSaving(false)
    }
    onClose()
  }

  const inputCls = 'h-8 w-full rounded-lg border border-[#F0F0F4] px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

  return (
    <div className="fixed inset-0 bg-black/30 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#0F0F12]">
            {title}{' '}
            <span className="text-[#999] font-normal text-xs">(optional)</span>
          </h3>
          <button onClick={onClose} className="text-[#999] hover:text-[#0F0F12] transition-colors">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {type === 'interview' && (
            <>
              <label className="block">
                <span className="text-xs text-[#999] mb-1 block">Interview Date</span>
                <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs text-[#999] mb-1 block">Interview Time</span>
                <input type="time" value={interviewTime} onChange={(e) => setInterviewTime(e.target.value)} className={inputCls} />
              </label>
            </>
          )}

          {type === 'offer' && (
            <>
              <label className="block">
                <span className="text-xs text-[#999] mb-1 block">Offered CTC (₹)</span>
                <input type="number" min="0" value={offeredCtc} onChange={(e) => setOfferedCtc(e.target.value)} placeholder="e.g. 1500000" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs text-[#999] mb-1 block">Billing Amount (₹)</span>
                <input type="number" min="0" value={billingAmount} onChange={(e) => setBillingAmount(e.target.value)} placeholder="e.g. 150000" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs text-[#999] mb-1 block">Date of Joining</span>
                <input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} className={inputCls} />
              </label>
            </>
          )}

          {type === 'joining' && (
            <>
              <label className="block">
                <span className="text-xs text-[#999] mb-1 block">Billing Amount (₹)</span>
                <input type="number" min="0" value={billingAmount} onChange={(e) => setBillingAmount(e.target.value)} placeholder="e.g. 150000" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs text-[#999] mb-1 block">Date of Joining</span>
                <input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} className={inputCls} />
              </label>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-4 rounded-lg text-sm font-semibold text-white bg-[#5E6AD2] hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg text-sm text-[#666] border border-[#F0F0F4] hover:bg-[#F5F5F8] transition"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── InlineDropdown ──────────────────────────────────────────────────────────
// Renders a badge; single click opens a dropdown list. Escape or outside click
// closes without saving. Selection calls onSelect(value) and closes.

export function InlineDropdown({ badge, options = [], onSelect, disabled = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleKeyDown(e) {
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={ref} className="relative inline-block" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!disabled && options.length > 0) setOpen(true) }}
        className={`rounded focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]/30 ${disabled ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
        title={disabled ? undefined : 'Click to edit'}
      >
        {badge}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-0.5 bg-white border border-[#E0E0E8] rounded-lg shadow-lg overflow-hidden min-w-[150px] max-h-56 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F5F5F8] text-[#0F0F12] transition-colors whitespace-nowrap"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(opt)
                setOpen(false)
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
