import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { generateApplicantId } from '../lib/generateApplicantId'
import { STAGES, STAGE_STATUS_MAP } from '../lib/candidateConstants'

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  )
}

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition disabled:bg-[#F5F5F8] disabled:text-[#999] disabled:cursor-not-allowed'
const labelCls = 'block text-xs font-medium text-[#666] mb-1'

// Derived from canonical STAGES — avoids any literal mismatch
const INTERVIEW_STAGES = STAGES.filter(s => !['CV', 'Offer', 'Joining'].includes(s))
const BILLING_STAGES = ['Offer', 'Joining']

// Props: candidateId, candidateName, onClose, onAssigned(applicantId)
export default function AssignMandateModal({ candidateId, candidateName, onClose, onAssigned }) {
  const [clients, setClients] = useState([])
  const [clientFilter, setClientFilter] = useState('')
  const [mandates, setMandates] = useState([])
  const [loadingMandates, setLoadingMandates] = useState(true)

  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState(1) // 1=pick mandate, 2=stage+status, 3=confirm

  const [stage, setStage] = useState('CV')
  const [status, setStatus] = useState('FB Pending')
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewTime, setInterviewTime] = useState('')
  const [offeredCtc, setOfferedCtc] = useState('')
  const [billingApprox, setBillingApprox] = useState('')
  const [joiningDate, setJoiningDate] = useState('')

  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const isInvoiceRaised = status === 'Invoice Raised'

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name')
      .order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [])

  useEffect(() => {
    setLoadingMandates(true)
    setSelected(null)
    let query = supabase
      .from('mandates')
      .select('id, title, job_id, clients(id, name)')
      .eq('status', 'active')
      .order('title')
    if (clientFilter) query = query.eq('client_id', clientFilter)
    query.then(({ data }) => {
      setMandates(data ?? [])
      setLoadingMandates(false)
    })
  }, [clientFilter])

  function handleStageChange(newStage) {
    setStage(newStage)
    setStatus(STAGE_STATUS_MAP[newStage]?.[0] ?? '')
    setInterviewDate('')
    setInterviewTime('')
    setOfferedCtc('')
    setBillingApprox('')
    setJoiningDate('')
  }

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const applicantId = await generateApplicantId()
      const payload = {
        mandate_id: selected.id,
        candidate_id: candidateId,
        linked_by: user.id,
        applicant_id: applicantId,
        stage,
        status,
        status_changed_at: new Date().toISOString(),
      }

      if (INTERVIEW_STAGES.includes(stage)) {
        if (interviewDate) payload.interview_date = interviewDate
        if (interviewTime) payload.interview_time = interviewTime
      }

      if (BILLING_STAGES.includes(stage)) {
        const ctcNum = offeredCtc !== '' ? parseFloat(offeredCtc) : null
        const approxNum = billingApprox !== '' ? parseFloat(billingApprox) : null
        if (ctcNum != null) payload.offered_ctc = ctcNum
        if (approxNum != null) {
          payload.billing_value_approx = approxNum
          // Invoice Raised locks approx → final
          if (isInvoiceRaised) payload.billing_value_final = approxNum
        }
        if (joiningDate) payload.date_of_joining = joiningDate
      }

      const { error: insertError } = await supabase.from('mandate_candidates').insert(payload)
      if (insertError) throw insertError
      onAssigned(applicantId, { mandateId: selected.id, jobId: selected.job_id ?? null })
    } catch (e) {
      setError(e.message)
      setConfirming(false)
    }
  }

  const headerTitle =
    step === 1 ? 'Assign to Mandate'
    : step === 2 ? 'Set Stage & Status'
    : 'Confirm Assignment'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#F0F0F4]">
          <h2 className="text-sm font-semibold text-[#0F0F12]">{headerTitle}</h2>
          <button onClick={onClose} className="text-[#999] hover:text-[#0F0F12] transition-colors">
            <CloseIcon />
          </button>
        </div>

        {step === 1 && (
          <div className="px-6 py-5 space-y-3">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className={fldCls}
            >
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {loadingMandates ? (
                <p className="text-sm text-[#999] py-8 text-center">Loading…</p>
              ) : mandates.length === 0 ? (
                <p className="text-sm text-[#999] py-8 text-center">No active mandates found</p>
              ) : (
                mandates.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelected(m); setStep(2) }}
                    className="w-full text-left rounded-xl border border-[#F0F0F4] px-3 py-2.5 hover:border-[#5E6AD2] hover:bg-[#5E6AD2]/5 transition"
                  >
                    <p className="text-sm font-medium text-[#0F0F12] truncate">{m.title}</p>
                    <p className="text-xs text-[#999] mt-0.5">{m.clients?.name}</p>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="px-6 py-5 space-y-4">
            {/* Stage + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Stage</label>
                <select value={stage} onChange={(e) => handleStageChange(e.target.value)} className={fldCls}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={fldCls}>
                  {(STAGE_STATUS_MAP[stage] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Interview fields — L1, L2, L3, Client Onsite, HR */}
            {INTERVIEW_STAGES.includes(stage) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Interview Date <span className="text-[#999] font-normal">(optional)</span></label>
                  <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className={fldCls} />
                </div>
                <div>
                  <label className={labelCls}>Interview Time <span className="text-[#999] font-normal">(optional)</span></label>
                  <input type="time" value={interviewTime} onChange={(e) => setInterviewTime(e.target.value)} className={fldCls} />
                </div>
              </div>
            )}

            {/* Billing fields — Offer and Joining stages */}
            {BILLING_STAGES.includes(stage) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Offered CTC <span className="text-[#999] font-normal">(optional)</span></label>
                    <input
                      type="number"
                      min="0"
                      value={offeredCtc}
                      onChange={(e) => setOfferedCtc(e.target.value)}
                      placeholder="e.g. 1200000"
                      className={fldCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Billing Amount <span className="text-[#999] font-normal">(optional)</span>
                      {isInvoiceRaised && <span className="ml-1 text-[#D93025] font-normal">locked</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={billingApprox}
                      onChange={(e) => setBillingApprox(e.target.value)}
                      disabled={isInvoiceRaised}
                      placeholder="e.g. 120000"
                      className={fldCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    Date of Joining <span className="text-[#999] font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    disabled={isInvoiceRaised}
                    className={fldCls}
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                onClick={() => { setSelected(null); setStep(1) }}
                className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition">
                  Cancel
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: '#5E6AD2' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl bg-[#FAFAFA] border border-[#F0F0F4] px-4 py-3">
              <p className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">Candidate</p>
              <p className="text-sm font-medium text-[#0F0F12]">{candidateName}</p>
            </div>
            <div className="rounded-xl bg-[#FAFAFA] border border-[#F0F0F4] px-4 py-3">
              <p className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">Mandate</p>
              <p className="text-sm font-medium text-[#0F0F12]">{selected.title}</p>
              <p className="text-xs text-[#999] mt-0.5">{selected.clients?.name}</p>
            </div>
            <div className="rounded-xl bg-[#FAFAFA] border border-[#F0F0F4] px-4 py-3">
              <p className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">Stage & Status</p>
              <p className="text-sm font-medium text-[#0F0F12]">{stage} — {status}</p>
              {INTERVIEW_STAGES.includes(stage) && (interviewDate || interviewTime) && (
                <p className="text-xs text-[#999] mt-0.5">
                  Interview: {interviewDate || '—'}{interviewTime ? ` at ${interviewTime}` : ''}
                </p>
              )}
              {BILLING_STAGES.includes(stage) && (offeredCtc || billingApprox || joiningDate) && (
                <div className="mt-1 space-y-0.5">
                  {offeredCtc && <p className="text-xs text-[#999]">Offered CTC: {offeredCtc}</p>}
                  {billingApprox && <p className="text-xs text-[#999]">Billing Amount: {billingApprox}</p>}
                  {joiningDate && <p className="text-xs text-[#999]">Date of Joining: {joiningDate}</p>}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-[#D93025]">{error}</p>}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button onClick={() => setStep(2)} className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition">
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition">
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#5E6AD2' }}
                >
                  {confirming ? 'Assigning…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
