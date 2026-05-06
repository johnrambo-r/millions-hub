import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { StageBadge, StatusBadge } from './StageBadge'
import {
  STAGES, STAGE_STATUS_MAP,
  QUALIFICATIONS, PASSING_YEARS, NOTICE_PERIODS,
} from '../../lib/candidateConstants'
import UnsavedChangesModal from '../UnsavedChangesModal'

function Field({ label, children, colSpan2 = false }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-[#0F0F12]">{children || '—'}</dd>
    </div>
  )
}

function EditField({ label, children, colSpan2 = false }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : ''}>
      <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">{label}</label>
      {children}
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

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

export default function CandidatePanel({ candidate, onClose, onUpdate, pendingSelect, onPendingResolved, onPendingCancelled }) {
  const { session } = useAuth()
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Stage / status update
  const [editStage, setEditStage] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // General edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Unsaved changes dialog
  const [dialog, setDialog] = useState(null)
  const [dialogSaving, setDialogSaving] = useState(false)

  // Resume upload
  const [resumeFile, setResumeFile] = useState(null)
  const resumeFileRef = useRef(null)
  const originalFieldsRef = useRef({})

  // Inline interview date/time
  const [editInterviewDate, setEditInterviewDate] = useState('')
  const [editInterviewTime, setEditInterviewTime] = useState('')
  const [interviewSaving, setInterviewSaving] = useState(false)
  const [interviewError, setInterviewError] = useState('')
  const [interviewSuccess, setInterviewSuccess] = useState(false)

  const isOpen = !!candidate

  useEffect(() => {
    if (isDirty) {
      window.onbeforeunload = () => true
    } else {
      window.onbeforeunload = null
    }
    return () => { window.onbeforeunload = null }
  }, [isDirty])

  // Compute isDirty by comparing current editFields against the values loaded when edit started
  useEffect(() => {
    if (!isEditing) return
    const orig = originalFieldsRef.current
    const dirty = !!resumeFile || Object.keys(editFields).some((k) => editFields[k] !== orig[k])
    setIsDirty(dirty)
  }, [editFields, resumeFile, isEditing])

  useEffect(() => {
    if (!candidate) {
      setHistory([])
      setEditStage('')
      setEditStatus('')
      setSaveError('')
      setIsEditing(false)
      setEditError('')
      setEditSuccess(false)
      setIsDirty(false)
      setDialog(null)
      return
    }

    console.log('[CandidatePanel] resume_url:', candidate.resume_url)

    setEditStage(candidate.stage ?? '')
    setEditStatus(candidate.status ?? '')
    setSaveError('')
    setIsEditing(false)
    setEditError('')
    setEditSuccess(false)
    setResumeFile(null)
    setIsDirty(false)
    setEditInterviewDate(candidate.interview_date ?? '')
    setEditInterviewTime(candidate.interview_time ?? '')
    setInterviewError('')
    setInterviewSuccess(false)

    setHistoryLoading(true)
    supabase
      .from('status_history')
      .select('id, stage, status, notes, changed_at, profiles(name)')
      .eq('candidate_id', candidate.id)
      .order('changed_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[CandidatePanel] status_history:', error.message)
        setHistory(data ?? [])
        setHistoryLoading(false)
      })
  }, [candidate?.id])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') handleRequestClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditing, isDirty])

  // Handle pending candidate switch from Pipeline
  useEffect(() => {
    if (!pendingSelect) return
    if (!isEditing || !isDirty) {
      onPendingResolved?.(pendingSelect)
      return
    }
    setDialog({
      message: 'Do you want to save your changes before switching candidates?',
      onSave: async () => {
        setDialogSaving(true)
        const ok = await performSave()
        setDialogSaving(false)
        setDialog(null)
        if (ok) onPendingResolved?.(pendingSelect)
        else onPendingCancelled?.()
      },
      onDiscard: () => {
        resetEditState()
        setDialog(null)
        onPendingResolved?.(pendingSelect)
      },
      onCancel: () => {
        setDialog(null)
        onPendingCancelled?.()
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelect])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function resetEditState() {
    setIsEditing(false)
    setEditError('')
    setIsDirty(false)
  }

  function handleRequestClose() {
    if (isDirty) {
      setDialog({
        message: 'Do you want to save your changes before closing?',
        onSave: async () => {
          setDialogSaving(true)
          const ok = await performSave()
          setDialogSaving(false)
          setDialog(null)
          if (ok) onClose()
        },
        onDiscard: () => {
          resetEditState()
          setDialog(null)
          onClose()
        },
        onCancel: () => setDialog(null),
      })
    } else {
      onClose()
    }
  }

  // ── Stage / status update ──────────────────────────────────────────────────

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
      .update({ stage: editStage, status: editStatus })
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

    if (histError) {
      console.error('[CandidatePanel] status_history insert:', histError.message)
      setSaveError(`Stage saved, but history not recorded: ${histError.message}`)
    }

    const { data: newHistory } = await supabase
      .from('status_history')
      .select('id, stage, status, notes, changed_at, profiles(name)')
      .eq('candidate_id', candidate.id)
      .order('changed_at', { ascending: true })

    setHistory(newHistory ?? [])
    setSaving(false)
    onUpdate?.({ stage: editStage, status: editStatus, status_changed_at: now })
  }

  // ── General edit mode ──────────────────────────────────────────────────────

  function extractStoragePath(url) {
    if (!url) return null
    if (!url.startsWith('http')) return url
    const marker = '/storage/v1/object/public/resumes/'
    const idx = url.indexOf(marker)
    return idx === -1 ? null : url.slice(idx + marker.length)
  }

  function handleEditStart() {
    setResumeFile(null)
    const fields = {
      name:               candidate.name ?? '',
      email:              candidate.email ?? '',
      phone:              candidate.phone ?? '',
      alt_contact:        candidate.alt_contact ?? '',
      current_location:   candidate.current_location ?? '',
      preferred_location: candidate.preferred_location ?? '',
      education:          candidate.education ?? '',
      year_of_passing:    candidate.year_of_passing?.toString() ?? '',
      current_company:    candidate.current_company ?? '',
      skill_role:         candidate.skill_role ?? '',
      total_exp:          candidate.total_exp?.toString() ?? '',
      relevant_exp:       candidate.relevant_exp?.toString() ?? '',
      emp_mode:           candidate.emp_mode ?? '',
      payroll_company:    candidate.payroll_company ?? '',
      notice_period:      candidate.notice_period ?? '',
      current_ctc:        candidate.current_ctc?.toString() ?? '',
      expected_ctc:       candidate.expected_ctc?.toString() ?? '',
      interview_date:     candidate.interview_date ?? '',
      interview_time:     candidate.interview_time ?? '',
      comments:           candidate.comments ?? '',
    }
    originalFieldsRef.current = { ...fields }
    setEditFields(fields)
    setEditError('')
    setEditSuccess(false)
    setIsDirty(false)
    setIsEditing(true)
  }

  function setEditField(key, value) {
    setEditFields((prev) => ({ ...prev, [key]: value }))
  }

  function handleEditCancel() {
    if (isDirty) {
      setDialog({
        message: 'Do you want to save your changes before cancelling?',
        onSave: async () => {
          setDialogSaving(true)
          const ok = await performSave()
          setDialogSaving(false)
          if (ok) setDialog(null)
          else setDialog(null)
        },
        onDiscard: () => {
          resetEditState()
          setDialog(null)
        },
        onCancel: () => setDialog(null),
      })
    } else {
      resetEditState()
    }
  }

  async function handleInterviewSave() {
    setInterviewSaving(true)
    setInterviewError('')

    const { error } = await supabase
      .from('candidates')
      .update({
        interview_date:  editInterviewDate || null,
        interview_time:  editInterviewTime || null,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)

    setInterviewSaving(false)

    if (error) {
      setInterviewError(error.message)
      return
    }

    setInterviewSuccess(true)
    setTimeout(() => setInterviewSuccess(false), 3000)
    onUpdate?.({ interview_date: editInterviewDate || null, interview_time: editInterviewTime || null })
  }

  // Core save logic — returns true on success, false on error
  async function performSave() {
    setEditSaving(true)
    setEditError('')

    let newResumeUrl = undefined
    if (resumeFile) {
      const fileExt = resumeFile.name.split('.').pop()
      const filePath = `${candidate.id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, resumeFile, { upsert: true })

      if (uploadError) {
        setEditError(`Resume upload failed: ${uploadError.message}`)
        setEditSaving(false)
        return false
      }

      if (candidate.resume_url) {
        const oldPath = extractStoragePath(candidate.resume_url)
        if (oldPath) await supabase.storage.from('resumes').remove([oldPath])
      }

      const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(filePath)
      newResumeUrl = urlData.publicUrl
    }

    const payload = {
      name:               editFields.name.trim() || null,
      email:              editFields.email.trim().toLowerCase() || null,
      phone:              editFields.phone.trim() || null,
      alt_contact:        editFields.alt_contact.trim() || null,
      current_location:   editFields.current_location.trim() || null,
      preferred_location: editFields.preferred_location.trim() || null,
      education:          editFields.education || null,
      year_of_passing:    editFields.year_of_passing ? parseInt(editFields.year_of_passing, 10) : null,
      current_company:    editFields.current_company.trim() || null,
      skill_role:         editFields.skill_role.trim() || null,
      total_exp:          editFields.total_exp !== '' ? parseFloat(editFields.total_exp) : null,
      relevant_exp:       editFields.relevant_exp !== '' ? parseFloat(editFields.relevant_exp) : null,
      emp_mode:           editFields.emp_mode || null,
      payroll_company:    editFields.payroll_company.trim() || null,
      notice_period:      editFields.notice_period || null,
      current_ctc:        editFields.current_ctc !== '' ? parseFloat(editFields.current_ctc) : null,
      expected_ctc:       editFields.expected_ctc !== '' ? parseFloat(editFields.expected_ctc) : null,
      interview_date:     editFields.interview_date || null,
      interview_time:     editFields.interview_time || null,
      comments:           editFields.comments.trim() || null,
      last_updated_at:    new Date().toISOString(),
      ...(newResumeUrl !== undefined && { resume_url: newResumeUrl }),
    }

    console.log('[CandidatePanel] update payload:', payload)

    const { error } = await supabase
      .from('candidates')
      .update(payload)
      .eq('id', candidate.id)

    setEditSaving(false)

    if (error) {
      console.error('[CandidatePanel] update error:', error)
      setEditError(error.message)
      return false
    }

    setIsEditing(false)
    setIsDirty(false)
    setEditSuccess(true)
    setTimeout(() => setEditSuccess(false), 3000)
    onUpdate?.(payload)
    return true
  }

  async function handleEditSave() {
    await performSave()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const resumeUrl = candidate?.resume_url?.startsWith('http')
    ? candidate.resume_url
    : candidate?.resume_url
      ? supabase.storage.from('resumes').getPublicUrl(candidate.resume_url).data.publicUrl
      : null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleRequestClose}
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
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing ? (
              <button
                onClick={handleEditStart}
                className="h-8 px-3 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:border-[#5E6AD2] hover:text-[#5E6AD2] transition"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleEditCancel}
                  className="h-8 px-3 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="h-8 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#5E6AD2' }}
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            )}
            <button
              onClick={handleRequestClose}
              className="text-[#999] hover:text-[#0F0F12] transition-colors"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Success banner */}
          {editSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Changes saved successfully.
            </div>
          )}

          {/* Stage / Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <StageBadge value={candidate?.stage} />
            <StatusBadge value={candidate?.status} />
          </div>

          {/* Inline edit controls — hidden during general edit */}
          {!isEditing && (
            <>
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
                      className={fldCls}
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
                      className={`${fldCls} ${!editStage ? 'text-[#999] bg-[#FAFAFA] cursor-not-allowed' : ''}`}
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

              <div className="pb-2">
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">
                  Update interview
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">
                      Interview date
                    </label>
                    <input
                      type="date"
                      value={editInterviewDate}
                      onChange={(e) => { setEditInterviewDate(e.target.value); setInterviewError('') }}
                      className={fldCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">
                      Interview time
                    </label>
                    <input
                      type="time"
                      value={editInterviewTime}
                      onChange={(e) => { setEditInterviewTime(e.target.value); setInterviewError('') }}
                      className={fldCls}
                    />
                  </div>
                </div>

                {interviewError && (
                  <p className="text-xs text-[#D93025] mt-2">{interviewError}</p>
                )}
                {interviewSuccess && (
                  <p className="text-xs text-green-600 mt-2">Interview details saved.</p>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleInterviewSave}
                    disabled={interviewSaving}
                    className="h-9 px-5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#5E6AD2' }}
                  >
                    {interviewSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          )}

          <hr className="border-[#F0F0F4]" />

          {isEditing ? (
            /* ── Edit form ────────────────────────────────────────────── */
            <div>
              {editError && (
                <p className="text-xs text-[#D93025] mb-4">{editError}</p>
              )}
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <EditField label="Full name">
                  <input type="text" value={editFields.name || ''} onChange={(e) => setEditField('name', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Email">
                  <input type="email" value={editFields.email || ''} onChange={(e) => setEditField('email', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Phone">
                  <input type="tel" value={editFields.phone || ''} onChange={(e) => setEditField('phone', e.target.value)} className={fldCls} maxLength={10} />
                </EditField>
                <EditField label="Alt contact">
                  <input type="tel" value={editFields.alt_contact || ''} onChange={(e) => setEditField('alt_contact', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Current location">
                  <input type="text" value={editFields.current_location || ''} onChange={(e) => setEditField('current_location', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Preferred location">
                  <input type="text" value={editFields.preferred_location || ''} onChange={(e) => setEditField('preferred_location', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Education">
                  <select value={editFields.education || ''} onChange={(e) => setEditField('education', e.target.value)} className={fldCls}>
                    <option value="">Select</option>
                    {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </EditField>
                <EditField label="Year of passing">
                  <select value={editFields.year_of_passing || ''} onChange={(e) => setEditField('year_of_passing', e.target.value)} className={fldCls}>
                    <option value="">Select</option>
                    {PASSING_YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </EditField>
                <EditField label="Current company">
                  <input type="text" value={editFields.current_company || ''} onChange={(e) => setEditField('current_company', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Skill / Role">
                  <input type="text" value={editFields.skill_role || ''} onChange={(e) => setEditField('skill_role', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Total exp (yrs)">
                  <input type="number" min={0} step={0.5} value={editFields.total_exp ?? ''} onChange={(e) => setEditField('total_exp', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Relevant exp (yrs)">
                  <input type="number" min={0} step={0.5} value={editFields.relevant_exp ?? ''} onChange={(e) => setEditField('relevant_exp', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Emp mode">
                  <select value={editFields.emp_mode || ''} onChange={(e) => setEditField('emp_mode', e.target.value)} className={fldCls}>
                    <option value="">Select</option>
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                  </select>
                </EditField>
                <EditField label="Payroll company">
                  <input
                    type="text"
                    value={editFields.payroll_company || ''}
                    onChange={(e) => setEditField('payroll_company', e.target.value)}
                    disabled={editFields.emp_mode !== 'Contract'}
                    className={`${fldCls} ${editFields.emp_mode !== 'Contract' ? 'opacity-40 cursor-not-allowed bg-[#FAFAFA]' : ''}`}
                  />
                </EditField>
                <EditField label="Notice period">
                  <select value={editFields.notice_period || ''} onChange={(e) => setEditField('notice_period', e.target.value)} className={fldCls}>
                    <option value="">Select</option>
                    {NOTICE_PERIODS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </EditField>
                <EditField label="Current CTC (LPA)">
                  <input type="number" min={0} step={0.5} value={editFields.current_ctc ?? ''} onChange={(e) => setEditField('current_ctc', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Expected CTC (LPA)">
                  <input type="number" min={0} step={0.5} value={editFields.expected_ctc ?? ''} onChange={(e) => setEditField('expected_ctc', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Interview date">
                  <input type="date" value={editFields.interview_date || ''} onChange={(e) => setEditField('interview_date', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Interview time">
                  <input type="time" value={editFields.interview_time || ''} onChange={(e) => setEditField('interview_time', e.target.value)} className={fldCls} />
                </EditField>
                <EditField label="Comments" colSpan2>
                  <textarea
                    value={editFields.comments || ''}
                    onChange={(e) => setEditField('comments', e.target.value)}
                    rows={3}
                    className={`${fldCls} h-auto py-2 resize-none`}
                  />
                </EditField>
                <EditField label="Resume" colSpan2>
                  {candidate.resume_url && (
                    <p className="text-xs text-[#666] mb-1.5">
                      Current: <span className="font-medium">{candidate.resume_url.split('/').pop()}</span>
                    </p>
                  )}
                  <input
                    ref={resumeFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => { setResumeFile(e.target.files?.[0] ?? null) }}
                  />
                  <div className="flex items-center gap-3 h-9">
                    <button
                      type="button"
                      onClick={() => resumeFileRef.current?.click()}
                      className="h-9 px-3 rounded-lg border border-[#F0F0F4] flex items-center gap-2 text-sm text-[#666] hover:border-[#5E6AD2] hover:text-[#5E6AD2] transition shrink-0"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                        <path d="M3 12V4a1 1 0 011-1h5l3 3v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
                        <path d="M9 3v3h3M6 9h4M8 7v4" strokeLinecap="round" />
                      </svg>
                      {candidate.resume_url ? 'Replace resume' : 'Choose file'}
                    </button>
                    <span className="text-sm text-[#999] truncate">
                      {resumeFile ? resumeFile.name : '.pdf, .doc, .docx'}
                    </span>
                  </div>
                </EditField>
              </div>
            </div>
          ) : (
            /* ── Read-only detail grid ────────────────────────────────── */
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
          )}

          {/* Resume link — shown whenever a valid resume URL can be resolved */}
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
                    {h.notes && (
                      <p className="text-xs text-[#666] mt-1.5 leading-relaxed">{h.notes}</p>
                    )}
                    {h.profiles?.name && (
                      <p className="text-xs text-[#999] mt-1">by {h.profiles.name}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved changes dialog */}
      {dialog && (
        <UnsavedChangesModal
          message={dialog.message}
          onSave={dialog.onSave}
          onDiscard={dialog.onDiscard}
          onCancel={dialog.onCancel}
          saving={dialogSaving}
        />
      )}
    </>
  )
}
