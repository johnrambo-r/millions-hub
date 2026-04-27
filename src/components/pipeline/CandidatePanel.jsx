import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { StageBadge, StatusBadge } from './StageBadge'
import { STAGES, STAGE_STATUS_MAP } from '../../lib/candidateConstants'

function Field({ label, children, colSpan2 = false }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-[#0F0F12]">{children || '—'}</dd>
    </div>
  )
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  )
}

const selectCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

export default function CandidatePanel({ candidate, onClose, onUpdate }) {
  const { session } = useAuth()
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [resumeUrl, setResumeUrl] = useState(null)

  const [editStage, setEditStage] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const isOpen = !!candidate

  useEffect(() => {
    if (!candidate) {
      setHistory([])
      setResumeUrl(null)
      setEditStage('')
      setEditStatus('')
      setSaveError('')
      return
    }

    setEditStage(candidate.stage ?? '')
    setEditStatus(candidate.status ?? '')
    setSaveError('')

    setHistoryLoading(true)
    supabase
      .from('status_history')
      .select('id, stage, status, note, changed_at, profiles(name)')
      .eq('candidate_id', candidate.id)
      .order('changed_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[CandidatePanel] status_history:', error.message)
        setHistory(data ?? [])
        setHistoryLoading(false)
      })

    if (candidate.resume_url) {
      supabase.storage
        .from('resumes')
        .createSignedUrl(candidate.resume_url, 3600)
        .then(({ data, error }) => {
          if (error) console.warn('[CandidatePanel] resume signed URL:', error.message)
          else setResumeUrl(data?.signedUrl ?? null)
        })
    } else {
      setResumeUrl(null)
    }
  }, [candidate?.id])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  function handleEditStageChange(e) {
    setEditStage(e.target.value)
    setEditStatus('')
    setSaveError('')
  }

  const editStatusOptions = editStage ? (STAGE_STATUS_MAP[editStage] ?? []) : []

  async function handleSave() {
    if (!editStage || !editStatus) {
      setSaveError('Select both a stage and status')
      return
    }

    setSaving(true)
    setSaveError('')

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('candidates')
      .update({ stage: editStage, status: editStatus, status_changed_at: now })
      .eq('id', candidate.id)

    if (updateError) {
      setSaveError(updateError.message)
      setSaving(false)
      return
    }

    const { error: histError } = await supabase.from('status_history').insert({
      candidate_id: candidate.id,
      stage:        editStage,
      status:       editStatus,
      changed_by:   session.user.id,
      changed_at:   now,
    })

    if (histError) console.error('[CandidatePanel] status_history insert:', histError.message)

    const { data: newHistory } = await supabase
      .from('status_history')
      .select('id, stage, status, note, changed_at, profiles(name)')
      .eq('candidate_id', candidate.id)
      .order('changed_at', { ascending: true })

    setHistory(newHistory ?? [])
    setSaving(false)

    onUpdate?.({ stage: editStage, status: editStatus, status_changed_at: now })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out"
        style={{ width: 480, transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        aria-modal="true"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#F0F0F4] shrink-0">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-[#0F0F12] truncate">{candidate?.name}</h2>
            {candidate?.id && (
              <p className="font-mono text-xs text-gray-400 mt-0.5">{candidate.id}</p>
            )}
            <p className="text-sm text-[#666] mt-0.5 truncate">{candidate?.skill_role ?? '—'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#999] hover:text-[#0F0F12] transition-colors shrink-0"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Stage / Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <StageBadge value={candidate?.stage} />
            <StatusBadge value={candidate?.status} />
          </div>

          {/* Full detail grid */}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Client">{candidate?.clients?.name}</Field>
            <Field label="Recruiter">{candidate?.profiles?.name}</Field>
            <Field label="Email">{candidate?.email}</Field>
            <Field label="Phone">{candidate?.phone}</Field>
            <Field label="Alt contact">{candidate?.alt_contact}</Field>
            <Field label="Current location">{candidate?.current_location}</Field>
            <Field label="Preferred location">{candidate?.preferred_location}</Field>
            <Field label="Education">{candidate?.education}</Field>
            <Field label="Year of passing">{candidate?.year_of_passing}</Field>
            <Field label="Current company">{candidate?.current_company}</Field>
            <Field label="Total exp">
              {candidate?.total_exp != null ? `${candidate.total_exp} yrs` : null}
            </Field>
            <Field label="Relevant exp">
              {candidate?.relevant_exp != null ? `${candidate.relevant_exp} yrs` : null}
            </Field>
            <Field label="Emp mode">{candidate?.emp_mode}</Field>
            {candidate?.payroll_company ? (
              <Field label="Payroll company">{candidate.payroll_company}</Field>
            ) : (
              <div />
            )}
            <Field label="Notice period">{candidate?.notice_period}</Field>
            <Field label="Current CTC">
              {candidate?.current_ctc != null ? `${candidate.current_ctc} LPA` : null}
            </Field>
            <Field label="Expected CTC">
              {candidate?.expected_ctc != null ? `${candidate.expected_ctc} LPA` : null}
            </Field>
            <Field label="Interview date">{formatDate(candidate?.interview_date)}</Field>
            <Field label="Interview time">{candidate?.interview_time}</Field>
            <Field label="Last updated">{formatDate(candidate?.status_changed_at)}</Field>
            {candidate?.comments && (
              <Field label="Comments" colSpan2>{candidate.comments}</Field>
            )}
          </dl>

          {/* Resume link */}
          {resumeUrl && (
            <div>
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[#5E6AD2] text-sm font-medium text-[#5E6AD2] hover:bg-[#5E6AD2]/5 transition"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <path d="M3 12V4a1 1 0 011-1h5l3 3v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
                  <path d="M9 3v3h3M6 9h4" strokeLinecap="round" />
                </svg>
                View Resume
              </a>
            </div>
          )}

          <hr className="border-[#F0F0F4]" />

          {/* Status history */}
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">
              Status history
            </h3>

            {historyLoading ? (
              <p className="text-sm text-[#999]">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-[#999]">No history recorded</p>
            ) : (
              <ol className="relative border-l-2 border-[#F0F0F4] space-y-5 pl-5">
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#5E6AD2] border-2 border-white" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StageBadge value={h.stage} />
                        <StatusBadge value={h.status} />
                      </div>
                      <span className="text-xs text-[#999] shrink-0 pt-0.5">{formatDate(h.changed_at)}</span>
                    </div>
                    {h.note && (
                      <p className="text-xs text-[#666] mt-1.5 leading-relaxed">{h.note}</p>
                    )}
                    {h.profiles?.name && (
                      <p className="text-xs text-[#999] mt-1">by {h.profiles.name}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <hr className="border-[#F0F0F4]" />

          {/* Update stage / status */}
          <div className="pb-2">
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">
              Update stage / status
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">
                  Stage
                </label>
                <select
                  value={editStage}
                  onChange={handleEditStageChange}
                  className={selectCls}
                >
                  <option value="">Select stage</option>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => { setEditStatus(e.target.value); setSaveError('') }}
                  disabled={!editStage}
                  className={`${selectCls} ${!editStage ? 'text-[#999] bg-[#FAFAFA] cursor-not-allowed' : ''}`}
                >
                  <option value="">{editStage ? 'Select status' : 'Select stage first'}</option>
                  {editStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-[#D93025] mt-2">{saveError}</p>
            )}

            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !editStage || !editStatus}
                className="h-9 px-5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#5E6AD2' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
