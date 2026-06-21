import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { StageBadge, StatusBadge } from './StageBadge'
import {
  QUALIFICATIONS, PASSING_YEARS, NOTICE_PERIODS,
} from '../../lib/candidateConstants'
import UnsavedChangesModal from '../UnsavedChangesModal'
import { generateApplicantId } from '../../lib/generateApplicantId'
import useRole from '../../hooks/useRole'

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

function formatDateShort(str) {
  if (!str) return null
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(str) {
  if (!str) return ''
  const [h, m] = str.split(':').map(Number)
  if (isNaN(h)) return str
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${period}`
}

function formatDateTime(str) {
  if (!str) return '—'
  const d = new Date(str)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${date} · ${time}`
}

function formatChangeType(str) {
  if (!str) return '—'
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatMoney(val) {
  if (val == null) return null
  const n = Number(val)
  if (n >= 100000) return `₹${n % 100000 === 0 ? n / 100000 : (n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `₹${Math.round(n / 1000)}K`
  return `₹${n}`
}

function daysInStageMC(mc) {
  const ref = mc.status_changed_at ?? mc.linked_at
  if (!ref) return 0
  return Math.floor((Date.now() - new Date(ref)) / 86400000)
}

function daysBadgeColor(days) {
  if (days >= 14) return 'text-red-600 bg-red-50'
  if (days >= 7)  return 'text-amber-600 bg-amber-50'
  return 'text-[#666] bg-[#F5F5F8]'
}

function safeParseJson(str) {
  if (!str) return null
  try { return JSON.parse(str) } catch { return null }
}

const SOURCE_OPTIONS = ['Naukri', 'LinkedIn', 'Referral', 'Database', 'Direct Approach', 'Other']

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  )
}

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

function LinkMandateModal({ candidateId, linkedMandateIds, userId, onClose, onLinked }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data, error } = await supabase
        .from('mandates')
        .select('id, title, clients(id, name)')
        .eq('status', 'active')
        .ilike('title', `%${query.trim()}%`)
        .limit(20)
      setSearching(false)
      if (error) setError(error.message)
      else setResults(data ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  async function handleLink(mandate) {
    setLinking(mandate.id)
    setError('')
    const applicantId = await generateApplicantId()
    const { error } = await supabase
      .from('mandate_candidates')
      .insert({ mandate_id: mandate.id, candidate_id: candidateId, linked_by: userId, applicant_id: applicantId })
    setLinking(null)
    if (error) setError(error.message)
    else onLinked()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F4] shrink-0">
          <h3 className="text-sm font-semibold text-[#0F0F12]">Link to Mandate</h3>
          <button onClick={onClose} className="text-[#999] hover:text-[#0F0F12] transition-colors">
            <CloseIcon />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-3 overflow-hidden">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError('') }}
            placeholder="Search active mandates by title…"
            className={fldCls}
            autoFocus
          />
          {error && <p className="text-xs text-[#D93025]">{error}</p>}
          <div className="space-y-2 overflow-y-auto max-h-64">
            {searching ? (
              <p className="text-sm text-[#999] py-6 text-center">Searching…</p>
            ) : query.trim() && results.length === 0 ? (
              <p className="text-sm text-[#999] py-6 text-center">No active mandates found</p>
            ) : (
              results.map((m) => {
                const alreadyLinked = linkedMandateIds.has(m.id)
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-[#F0F0F4] px-3 py-2.5">
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium text-[#0F0F12] truncate">{m.title}</p>
                      <p className="text-xs text-[#999] mt-0.5">{m.clients?.name}</p>
                    </div>
                    {alreadyLinked ? (
                      <span className="text-xs text-[#999] shrink-0">Already linked</span>
                    ) : (
                      <button
                        onClick={() => handleLink(m)}
                        disabled={!!linking}
                        className="h-7 px-3 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: '#5E6AD2' }}
                      >
                        {linking === m.id ? 'Linking…' : 'Link'}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CandidatePanel({ candidate, onClose, onUpdate, pendingSelect, onPendingResolved, onPendingCancelled }) {
  const { session } = useAuth()
  const { role, isRecruiter, loading: roleLoading } = useRole()
  const userId = session?.user?.id

  const [activityLog, setActivityLog] = useState([])
  const [activityLogLoading, setActivityLogLoading] = useState(false)

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

  // Mandates section
  const [linkedMandates, setLinkedMandates] = useState([])
  const [mandatesLoading, setMandatesLoading] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)

  // Inline MC field editing (AM/Founder only)
  const [editingMcId, setEditingMcId] = useState(null)
  const [mcEditFields, setMcEditFields] = useState({})
  const [mcSaving, setMcSaving] = useState(false)

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
      setActivityLog([])
      setActivityLogLoading(false)
      setIsEditing(false)
      setEditError('')
      setEditSuccess(false)
      setIsDirty(false)
      setDialog(null)
      setLinkedMandates([])
      setMandatesLoading(false)
      setShowLinkModal(false)
      setEditingMcId(null)
      return
    }

    console.log('[CandidatePanel] resume_url:', candidate.resume_url)

    setIsEditing(false)
    setEditError('')
    setEditSuccess(false)
    setResumeFile(null)
    setIsDirty(false)

    loadLinkedMandates(candidate.id)
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

  // Fetch activity log once both candidate and role are known
  useEffect(() => {
    if (!candidate?.id || roleLoading) return
    loadActivityLog(candidate.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id, role, roleLoading])

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function loadActivityLog(candidateId) {
    setActivityLogLoading(true)

    // Fetch raw rows — no FK joins, as activity_log may not have schema-defined
    // foreign keys to profiles or mandates, which causes PostgREST to error the
    // whole query and return null data.
    let query = supabase
      .from('activity_log')
      .select('id, change_type, old_value, new_value, created_at, mandate_id, changed_by')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })

    if (role === 'recruiter') {
      query = query.eq('changed_by', userId)
    }

    const { data, error } = await query
    if (error) {
      console.error('[CandidatePanel] activity_log:', error.message)
      setActivityLog([])
      setActivityLogLoading(false)
      return
    }
    if (!data?.length) {
      setActivityLog([])
      setActivityLogLoading(false)
      return
    }

    // Enrich: profile names for changed_by UUIDs
    const changedByIds = [...new Set(data.map((e) => e.changed_by).filter(Boolean))]
    const profileMap = {}
    if (changedByIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', changedByIds)
      profiles?.forEach((p) => { profileMap[p.id] = p.name })
    }

    // Enrich: mandate title + job_id for mandate_ids
    const mandateIds = [...new Set(data.map((e) => e.mandate_id).filter(Boolean))]
    const mandateMap = {}
    if (mandateIds.length > 0) {
      const { data: mandates } = await supabase
        .from('mandates')
        .select('id, title, job_id')
        .in('id', mandateIds)
      mandates?.forEach((m) => { mandateMap[m.id] = m })
    }

    setActivityLog(data.map((entry) => ({
      ...entry,
      profiles: entry.changed_by ? { name: profileMap[entry.changed_by] ?? null } : null,
      mandates: entry.mandate_id ? (mandateMap[entry.mandate_id] ?? null) : null,
    })))
    setActivityLogLoading(false)
  }

  function loadLinkedMandates(candidateId) {
    setMandatesLoading(true)
    supabase
      .from('mandate_candidates')
      .select('id, mandate_id, stage, status, applicant_id, status_changed_at, linked_at, interview_date, interview_time, offered_ctc, billing_value_approx, billing_value_final, date_of_joining, offer_date, tentative_invoice_date, invoice_date, mandates(id, title, job_id, clients(id, name))')
      .eq('candidate_id', candidateId)
      .order('linked_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[CandidatePanel] mandate_candidates:', error.message)
        setLinkedMandates(data ?? [])
        setMandatesLoading(false)
      })
  }

  function resetEditState() {
    setIsEditing(false)
    setEditError('')
    setIsDirty(false)
  }

  function handleRequestClose() {
    const orig = originalFieldsRef.current
    const currentlyDirty = isEditing && (
      !!resumeFile ||
      Object.keys(editFields).some((k) => editFields[k] !== orig[k])
    )

    if (currentlyDirty) {
      setDialog({
        message: 'You have unsaved changes. What would you like to do?',
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
    const ctcParsed    = safeParseJson(candidate.ctc_breakup)
    const offersParsed = safeParseJson(candidate.offers_in_hand)
    const fields = {
      name:                 candidate.name ?? '',
      email:                candidate.email ?? '',
      phone:                candidate.phone ?? '',
      alt_contact:          candidate.alt_contact ?? '',
      current_location:     candidate.current_location ?? '',
      preferred_location:   candidate.preferred_location ?? '',
      education:            candidate.education ?? '',
      year_of_passing:      candidate.year_of_passing?.toString() ?? '',
      current_company:      candidate.current_company ?? '',
      skill_role:           candidate.skill_role ?? '',
      total_exp:            candidate.total_exp?.toString() ?? '',
      relevant_exp:         candidate.relevant_exp?.toString() ?? '',
      emp_mode:             candidate.emp_mode ?? '',
      payroll_company:      candidate.payroll_company ?? '',
      notice_period:        candidate.notice_period ?? '',
      current_ctc:          candidate.current_ctc?.toString() ?? '',
      expected_ctc:         candidate.expected_ctc?.toString() ?? '',
      comments:             candidate.comments ?? '',
      source:               candidate.source ?? '',
      linkedin_url:         candidate.linkedin_url ?? '',
      willing_to_relocate:  candidate.willing_to_relocate ?? false,
      reason_for_looking:   candidate.reason_for_looking ?? '',
      languages_known:      candidate.languages_known ?? '',
      ctc_breakup_fixed:    ctcParsed?.fixed    != null ? String(ctcParsed.fixed)    : '',
      ctc_breakup_variable: ctcParsed?.variable != null ? String(ctcParsed.variable) : '',
      offers_count:         offersParsed?.count   != null ? String(offersParsed.count)   : '',
      offers_details:       offersParsed?.details ?? '',
      lwd:                  candidate.lwd ?? '',
      dob:                  candidate.dob ?? '',
      notable_ids:          candidate.notable_ids ?? '',
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
      comments:           editFields.comments.trim() || null,
      source:             editFields.source || null,
      linkedin_url:       editFields.linkedin_url.trim() || null,
      willing_to_relocate: editFields.willing_to_relocate ?? false,
      reason_for_looking: editFields.reason_for_looking.trim() || null,
      languages_known:    editFields.languages_known.trim() || null,
      ctc_breakup: (editFields.ctc_breakup_fixed || editFields.ctc_breakup_variable)
        ? JSON.stringify({
            fixed:    editFields.ctc_breakup_fixed    !== '' ? parseFloat(editFields.ctc_breakup_fixed)    : null,
            variable: editFields.ctc_breakup_variable !== '' ? parseFloat(editFields.ctc_breakup_variable) : null,
          })
        : null,
      offers_in_hand: (editFields.offers_count || editFields.offers_details)
        ? JSON.stringify({
            count:   editFields.offers_count !== '' ? parseInt(editFields.offers_count, 10) : null,
            details: editFields.offers_details.trim() || null,
          })
        : null,
      lwd:         editFields.lwd         || null,
      dob:         editFields.dob         || null,
      notable_ids: editFields.notable_ids.trim() || null,
      last_updated_at: new Date().toISOString(),
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

  const linkedMandateIds = new Set(linkedMandates.map((mc) => mc.mandate_id))

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

          {/* Mandate Activity */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider">
                Mandate Activity
              </h3>
              <button
                onClick={() => setShowLinkModal(true)}
                className="h-7 px-3 rounded-lg text-xs font-semibold border border-[#5E6AD2] text-[#5E6AD2] hover:bg-[#5E6AD2]/5 transition"
              >
                Link to Mandate
              </button>
            </div>

            {mandatesLoading ? (
              <p className="text-sm text-[#999]">Loading…</p>
            ) : linkedMandates.length === 0 ? (
              <p className="text-sm text-[#999]">Not linked to any mandates</p>
            ) : (
              <ul className="space-y-3">
                {linkedMandates.map((mc) => {
                  const days = daysInStageMC(mc)
                  const interviewLine = mc.interview_date
                    ? [formatDateShort(mc.interview_date), mc.interview_time ? formatTime(mc.interview_time) : null].filter(Boolean).join(' · ')
                    : null
                  return (
                    <li key={mc.id} className="rounded-lg border border-[#F0F0F4] px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0F0F12] truncate">
                            {mc.mandates?.title ?? '—'}
                            {mc.mandates?.job_id && (
                              <span className="font-mono text-xs text-[#999] ml-1.5">{mc.mandates.job_id}</span>
                            )}
                          </p>
                          <p className="text-xs text-[#999] mt-0.5">{mc.mandates?.clients?.name}</p>
                        </div>
                        {mc.applicant_id && (
                          <span className="font-mono text-xs text-[#999] shrink-0">{mc.applicant_id}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {mc.stage  && <StageBadge value={mc.stage} />}
                        {mc.status && <StatusBadge value={mc.status} />}
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${daysBadgeColor(days)}`}>
                          {days}d
                        </span>
                        {!isRecruiter && ['Offer', 'Joining'].includes(mc.stage) && editingMcId !== mc.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingMcId(mc.id)
                              setMcEditFields({
                                offer_date:             mc.offer_date ?? '',
                                offered_ctc:            mc.offered_ctc?.toString() ?? '',
                                billing_value_approx:   mc.billing_value_approx?.toString() ?? '',
                                date_of_joining:        mc.date_of_joining ?? '',
                                tentative_invoice_date: mc.tentative_invoice_date ?? '',
                                invoice_date:           mc.invoice_date ?? '',
                                billing_value_final:    mc.billing_value_final?.toString() ?? '',
                              })
                            }}
                            className="text-[#999] hover:text-[#5E6AD2] transition-colors ml-1"
                            title="Edit offer/joining details"
                          >
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                              <path d="M11.5 2.5l2 2L5 13l-3 1 1-3 8.5-8.5z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {editingMcId === mc.id ? (
                        <div className="mt-2 space-y-2 bg-[#FAFAFA] rounded-lg p-3 border border-[#F0F0F4]">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="text-[10px] text-[#999] mb-0.5 block">Offer Date</span>
                              <input type="date" value={mcEditFields.offer_date} onChange={(e) => setMcEditFields(p => ({ ...p, offer_date: e.target.value }))} className="h-7 w-full rounded border border-[#E0E0E8] px-2 text-xs" />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-[#999] mb-0.5 block">Offered CTC (₹)</span>
                              <input type="number" value={mcEditFields.offered_ctc} onChange={(e) => setMcEditFields(p => ({ ...p, offered_ctc: e.target.value }))} className="h-7 w-full rounded border border-[#E0E0E8] px-2 text-xs" />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-[#999] mb-0.5 block">Billing Amount (₹)</span>
                              <input type="number" value={mcEditFields.billing_value_approx} onChange={(e) => setMcEditFields(p => ({ ...p, billing_value_approx: e.target.value }))} className="h-7 w-full rounded border border-[#E0E0E8] px-2 text-xs" />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-[#999] mb-0.5 block">Date of Joining</span>
                              <input type="date" value={mcEditFields.date_of_joining} onChange={(e) => setMcEditFields(p => ({ ...p, date_of_joining: e.target.value }))} className="h-7 w-full rounded border border-[#E0E0E8] px-2 text-xs" />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-[#999] mb-0.5 block">Tentative Invoice Date</span>
                              <input type="date" value={mcEditFields.tentative_invoice_date} onChange={(e) => setMcEditFields(p => ({ ...p, tentative_invoice_date: e.target.value }))} className="h-7 w-full rounded border border-[#E0E0E8] px-2 text-xs" />
                            </label>
                            <label className="block">
                              <span className="text-[10px] text-[#999] mb-0.5 block">Invoice Date</span>
                              <input type="date" value={mcEditFields.invoice_date} onChange={(e) => setMcEditFields(p => ({ ...p, invoice_date: e.target.value }))} className="h-7 w-full rounded border border-[#E0E0E8] px-2 text-xs" />
                            </label>
                            <label className="block col-span-2">
                              <span className="text-[10px] text-[#999] mb-0.5 block">Final Billing Amount (₹)</span>
                              <input type="number" value={mcEditFields.billing_value_final} onChange={(e) => setMcEditFields(p => ({ ...p, billing_value_final: e.target.value }))} className="h-7 w-full rounded border border-[#E0E0E8] px-2 text-xs" />
                            </label>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={async () => {
                                setMcSaving(true)
                                const updates = {
                                  offer_date:             mcEditFields.offer_date || null,
                                  offered_ctc:            mcEditFields.offered_ctc ? parseFloat(mcEditFields.offered_ctc) : null,
                                  billing_value_approx:   mcEditFields.billing_value_approx ? parseFloat(mcEditFields.billing_value_approx) : null,
                                  date_of_joining:        mcEditFields.date_of_joining || null,
                                  tentative_invoice_date: mcEditFields.tentative_invoice_date || null,
                                  invoice_date:           mcEditFields.invoice_date || null,
                                  billing_value_final:    mcEditFields.billing_value_final ? parseFloat(mcEditFields.billing_value_final) : null,
                                }
                                await supabase.from('mandate_candidates').update(updates).eq('id', mc.id)
                                setMcSaving(false)
                                setEditingMcId(null)
                                loadLinkedMandates(candidate.id)
                              }}
                              disabled={mcSaving}
                              className="h-7 px-3 rounded-lg text-xs font-semibold text-white bg-[#5E6AD2] hover:opacity-90 disabled:opacity-50 transition"
                            >
                              {mcSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingMcId(null)}
                              className="h-7 px-3 rounded-lg text-xs text-[#666] border border-[#E0E0E8] hover:bg-white transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        (interviewLine || mc.offered_ctc != null || mc.billing_value_approx != null || mc.billing_value_final != null || mc.date_of_joining) && (
                          <div className="mt-2 space-y-0.5">
                            {interviewLine && (
                              <p className="text-xs text-[#555]"><span className="text-[#999] mr-1">Interview</span>{interviewLine}</p>
                            )}
                            {mc.offered_ctc != null && (
                              <p className="text-xs text-[#555]"><span className="text-[#999] mr-1">Offered CTC</span>{formatMoney(mc.offered_ctc)}</p>
                            )}
                            {mc.billing_value_approx != null && (
                              <p className="text-xs text-[#555]"><span className="text-[#999] mr-1">Billing</span>{formatMoney(mc.billing_value_approx)}</p>
                            )}
                            {mc.billing_value_final != null && (
                              <p className="text-xs text-[#555]"><span className="text-[#999] mr-1">Final Billing</span>{formatMoney(mc.billing_value_final)}</p>
                            )}
                            {mc.date_of_joining && (
                              <p className="text-xs text-[#555]"><span className="text-[#999] mr-1">DOJ</span>{formatDateShort(mc.date_of_joining)}</p>
                            )}
                          </div>
                        )
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

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
                <EditField label="Comments" colSpan2>
                  <textarea
                    value={editFields.comments || ''}
                    onChange={(e) => setEditField('comments', e.target.value)}
                    rows={3}
                    className={`${fldCls} h-auto py-2 resize-none`}
                  />
                </EditField>
                <EditField label="Source">
                  <select value={editFields.source || ''} onChange={(e) => setEditField('source', e.target.value)} className={fldCls}>
                    <option value="">Select</option>
                    {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </EditField>
                <EditField label="LinkedIn URL">
                  <input type="url" value={editFields.linkedin_url || ''} onChange={(e) => setEditField('linkedin_url', e.target.value)} className={fldCls} placeholder="https://linkedin.com/in/…" />
                </EditField>
                <EditField label="Willing to relocate">
                  <div className="flex rounded-lg overflow-hidden border border-[#F0F0F4] h-9">
                    <button type="button" onClick={() => setEditField('willing_to_relocate', true)}
                      className={`flex-1 text-sm font-medium transition ${editFields.willing_to_relocate ? 'bg-[#5E6AD2] text-white' : 'bg-white text-[#666] hover:bg-[#F5F5F8]'}`}>Yes</button>
                    <button type="button" onClick={() => setEditField('willing_to_relocate', false)}
                      className={`flex-1 text-sm font-medium transition ${!editFields.willing_to_relocate ? 'bg-[#5E6AD2] text-white' : 'bg-white text-[#666] hover:bg-[#F5F5F8]'}`}>No</button>
                  </div>
                </EditField>
                <EditField label="Languages known">
                  <input type="text" value={editFields.languages_known || ''} onChange={(e) => setEditField('languages_known', e.target.value)} className={fldCls} placeholder="e.g. English, Hindi" />
                </EditField>
                <EditField label="Reason for looking" colSpan2>
                  <textarea value={editFields.reason_for_looking || ''} onChange={(e) => setEditField('reason_for_looking', e.target.value)} rows={2} className={`${fldCls} h-auto py-2 resize-none`} />
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

              {/* Additional Info */}
              <div className="mt-6 pt-5 border-t border-[#F0F0F4]">
                <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-4">Additional Info</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <EditField label="CTC Fixed (LPA)">
                    <input type="number" min={0} step={0.5} value={editFields.ctc_breakup_fixed ?? ''} onChange={(e) => setEditField('ctc_breakup_fixed', e.target.value)} className={fldCls} />
                  </EditField>
                  <EditField label="CTC Variable (LPA)">
                    <input type="number" min={0} step={0.5} value={editFields.ctc_breakup_variable ?? ''} onChange={(e) => setEditField('ctc_breakup_variable', e.target.value)} className={fldCls} />
                  </EditField>
                  <EditField label="Offers in hand (#)">
                    <input type="number" min={0} step={1} value={editFields.offers_count ?? ''} onChange={(e) => setEditField('offers_count', e.target.value)} className={fldCls} />
                  </EditField>
                  <EditField label="Offers details">
                    <input type="text" value={editFields.offers_details || ''} onChange={(e) => setEditField('offers_details', e.target.value)} className={fldCls} placeholder="Company X – 18L" />
                  </EditField>
                  <EditField label="Last working day">
                    <input type="date" value={editFields.lwd || ''} onChange={(e) => setEditField('lwd', e.target.value)} className={fldCls} />
                  </EditField>
                  <EditField label="Date of birth">
                    <input type="date" value={editFields.dob || ''} onChange={(e) => setEditField('dob', e.target.value)} className={fldCls} />
                  </EditField>
                  <EditField label="Notable IDs" colSpan2>
                    <textarea value={editFields.notable_ids || ''} onChange={(e) => setEditField('notable_ids', e.target.value)} rows={2} className={`${fldCls} h-auto py-2 resize-none`} placeholder="PAN, Passport, Aadhar, etc." />
                  </EditField>
                </div>
              </div>
            </div>
          ) : (
            /* ── Read-only detail grid ────────────────────────────────── */
            <>
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
                <Field label="Source">{candidate?.source}</Field>
                <Field label="Languages known">{candidate?.languages_known}</Field>
                <Field label="Willing to relocate">
                  {candidate?.willing_to_relocate != null ? (candidate.willing_to_relocate ? 'Yes' : 'No') : null}
                </Field>
                <Field label="Last updated">{formatDate(candidate?.status_changed_at)}</Field>
                {candidate?.linkedin_url && (
                  <Field label="LinkedIn" colSpan2>
                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#5E6AD2] hover:underline truncate block text-sm">
                      {candidate.linkedin_url}
                    </a>
                  </Field>
                )}
                {candidate?.reason_for_looking && (
                  <Field label="Reason for looking" colSpan2>{candidate.reason_for_looking}</Field>
                )}
                {candidate?.comments && (
                  <Field label="Comments" colSpan2>{candidate.comments}</Field>
                )}
              </dl>

              <div className="mt-4 pt-4 border-t border-[#F0F0F4]">
                <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3">Additional Info</p>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Field label="CTC Breakup" colSpan2>
                    {(() => {
                      const p = safeParseJson(candidate?.ctc_breakup)
                      return p ? `${p.fixed ?? '—'} Fixed + ${p.variable ?? '—'} Variable (LPA)` : candidate?.ctc_breakup
                    })()}
                  </Field>
                  <Field label="Offers in hand" colSpan2>
                    {(() => {
                      const p = safeParseJson(candidate?.offers_in_hand)
                      if (!p) return candidate?.offers_in_hand || null
                      return [
                        p.count != null ? `${p.count} offer${p.count !== 1 ? 's' : ''}` : null,
                        p.details,
                      ].filter(Boolean).join(' — ') || null
                    })()}
                  </Field>
                  <Field label="Last working day">{candidate?.lwd ? formatDateShort(candidate.lwd) : null}</Field>
                  <Field label="Date of birth">{candidate?.dob ? formatDate(candidate.dob) : null}</Field>
                  <Field label="Notable IDs" colSpan2>{candidate?.notable_ids}</Field>
                </dl>
              </div>
            </>
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

          {/* Activity log */}
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">
              Activity log
            </h3>

            {activityLogLoading ? (
              <p className="text-sm text-[#999]">Loading…</p>
            ) : activityLog.length === 0 ? (
              <p className="text-sm text-[#999]">No activity recorded yet</p>
            ) : (
              <div className="space-y-5">
                {(() => {
                  // Group entries by mandate, preserving most-recent-first order
                  const groups = []
                  const seen = new Map()
                  for (const entry of activityLog) {
                    const key = entry.mandate_id ?? '__none__'
                    if (!seen.has(key)) {
                      const g = { mandate: entry.mandates, entries: [] }
                      seen.set(key, g)
                      groups.push(g)
                    }
                    seen.get(key).entries.push(entry)
                  }
                  return groups.map((group, gi) => (
                    <div key={gi}>
                      {/* Mandate header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-[#0F0F12]">
                          {group.mandate?.title ?? 'Unknown mandate'}
                        </span>
                        {group.mandate?.job_id && (
                          <span className="font-mono text-xs text-[#999]">{group.mandate.job_id}</span>
                        )}
                      </div>
                      {/* Entries */}
                      <ol className="relative border-l-2 border-[#F0F0F4] space-y-4 pl-5">
                        {group.entries.map((entry) => (
                          <li key={entry.id} className="relative">
                            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#5E6AD2] border-2 border-white" />
                            <p className="text-xs text-[#999]">{formatDateTime(entry.created_at)}</p>
                            <p className="text-sm text-[#0F0F12] mt-0.5">
                              <span className="font-medium">{formatChangeType(entry.change_type)}</span>
                              {(entry.old_value != null || entry.new_value != null) && (
                                <span className="text-[#666]">
                                  {entry.old_value != null && (
                                    <> <span className="text-[#999]">{entry.old_value}</span></>
                                  )}
                                  {entry.old_value != null && entry.new_value != null && (
                                    <span className="text-[#999]"> → </span>
                                  )}
                                  {entry.new_value != null && (
                                    <span className="text-[#0F0F12] font-medium">{entry.new_value}</span>
                                  )}
                                </span>
                              )}
                            </p>
                            {entry.profiles?.name && (
                              <p className="text-xs text-[#999] mt-0.5">by {entry.profiles.name}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))
                })()}
              </div>
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

      {/* Link to mandate modal */}
      {showLinkModal && candidate && (
        <LinkMandateModal
          candidateId={candidate.id}
          linkedMandateIds={linkedMandateIds}
          userId={session?.user?.id}
          onClose={() => setShowLinkModal(false)}
          onLinked={() => {
            setShowLinkModal(false)
            loadLinkedMandates(candidate.id)
          }}
        />
      )}
    </>
  )
}
