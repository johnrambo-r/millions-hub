import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import FormSection from '../components/add-candidate/FormSection'
import FormField, { inputCls, inputReadOnly } from '../components/add-candidate/FormField'
import DuplicateModal from '../components/add-candidate/DuplicateModal'
import SuccessToast from '../components/add-candidate/SuccessToast'
import AssignMandateModal from '../components/AssignMandateModal'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { QUALIFICATIONS, NOTICE_PERIODS, PASSING_YEARS } from '../lib/candidateConstants'

// ─── constants ─────────────────────────────────────────────────────────────

const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const SOURCE_OPTIONS = ['Naukri', 'LinkedIn', 'Referral', 'Database', 'Direct Approach', 'Other']

const INITIAL = {
  // Identity
  name: '', email: '', phone: '', alt_contact: '',
  // Location
  current_location: '', hometown: '', preferred_location: '', willing_to_relocate: false,
  // Professional
  current_company: '', skill_role: '', emp_mode: '', payroll_company: '',
  total_exp: '', relevant_exp: '',
  education: '', year_of_passing: '',
  // Compensation
  current_ctc: '', ctc_breakup_fixed: '', ctc_breakup_variable: '',
  expected_ctc_min: '', expected_ctc_max: '',
  // Availability
  notice_period: '', lwd: '', dob: '',
  offers_count: '', offers_details: '',
  // Additional
  linkedin_url: '', languages_known: '', reason_for_looking: '',
  source: '', comments: '',
}

function validate(f, resumeUpload) {
  const e = {}
  if (!f.name.trim())               e.name             = 'Required'
  if (!f.email.trim())              e.email            = 'Required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email'
  if (!f.phone.trim())              e.phone            = 'Required'
  else if (!/^\d{10}$/.test(f.phone.trim())) e.phone   = 'Must be exactly 10 digits'
  if (!f.current_location.trim())   e.current_location = 'Required'
  if (!f.hometown.trim())           e.hometown         = 'Required'
  if (!f.preferred_location.trim()) e.preferred_location = 'Required'
  if (!f.current_company.trim())    e.current_company  = 'Required'
  if (!f.skill_role.trim())         e.skill_role       = 'Required'
  if (f.total_exp === '')           e.total_exp        = 'Required'
  if (f.relevant_exp === '')        e.relevant_exp     = 'Required'
  if (!f.education)                 e.education        = 'Required'
  if (!f.year_of_passing)           e.year_of_passing  = 'Required'
  if (f.current_ctc === '')         e.current_ctc      = 'Required'
  if (f.expected_ctc_min === '')    e.expected_ctc_min = 'Required'
  if (f.expected_ctc_max === '')    e.expected_ctc_max = 'Required'
  if (f.expected_ctc_min !== '' && f.expected_ctc_max !== '' &&
      parseFloat(f.expected_ctc_max) < parseFloat(f.expected_ctc_min))
                                    e.expected_ctc_max = 'Max must be ≥ Min'
  if (!f.notice_period)             e.notice_period    = 'Required'
  if (!f.source)                    e.source           = 'Required'
  if (f.emp_mode === 'Contract' && !f.payroll_company.trim())
                                    e.payroll_company  = 'Required for contract'
  if (resumeUpload.status !== 'done' || !resumeUpload.url) {
    e.resume =
      resumeUpload.status === 'uploading' ? 'Resume is still uploading — please wait' :
      resumeUpload.status === 'error'     ? 'Resume upload failed — please retry' :
                                             'Resume is required'
  }
  return e
}

// ─── shared select ─────────────────────────────────────────────────────────

function Select({ value, onChange, error, disabled, placeholder, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`${inputCls(error)} ${disabled ? 'text-[#999] bg-[#FAFAFA] cursor-not-allowed' : ''}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  )
}

// ─── post-add prompt ───────────────────────────────────────────────────────

function PostAddPromptModal({ candidateId, onAssign, onSkip }) {
  if (!candidateId) return null
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 16 16" fill="none" stroke="#1D8A5E" strokeWidth="1.75" className="w-4 h-4">
              <path d="M3 8l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F0F12]">Candidate added</p>
            <p className="font-mono text-xs text-[#999] mt-0.5">{candidateId}</p>
          </div>
        </div>
        <p className="text-sm text-[#666] mb-5">Assign to a mandate now?</p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onSkip} className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition">
            Skip
          </button>
          <button onClick={onAssign} className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: '#5E6AD2' }}>
            Assign to mandate →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function AddCandidate() {
  const navigate   = useNavigate()
  const profile    = useProfile()

  const [form, setForm]           = useState(INITIAL)
  const [errors, setErrors]       = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [duplicates, setDuplicates] = useState(null)
  const [postAdd, setPostAdd]     = useState(null)
  const [assignTarget, setAssignTarget] = useState(null)
  const [appIdToast, setAppIdToast] = useState('')
  const [resumeFile, setResumeFile] = useState(null)
  // Upload starts the moment a file is selected, not at submit time, so
  // Submit can be blocked for the entire window a resume is in flight
  // instead of racing it. 'idle' | 'uploading' | 'done' | 'error'.
  const [resumeUploadStatus, setResumeUploadStatus] = useState('idle')
  const [resumeUploadError, setResumeUploadError]   = useState('')
  const [resumeUploadPath, setResumeUploadPath]     = useState(null)
  const [resumeUploadUrl, setResumeUploadUrl]       = useState(null)
  const resumeUploadTokenRef      = useRef(0) // guards against a stale upload clobbering a newer one
  const [fileKey, setFileKey]     = useState(0)
  const fileInputRef              = useRef(null)
  const [formError, setFormError] = useState('')

  const isDirty = Object.keys(INITIAL).some((key) => form[key] !== INITIAL[key]) || !!resumeFile

  useEffect(() => {
    if (isDirty) { window.onbeforeunload = () => true }
    else         { window.onbeforeunload = null }
    return () => { window.onbeforeunload = null }
  }, [isDirty])

  function setField(key, value) {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  function handleModeChange(e) {
    const val = e.target.value
    setForm((p) => ({ ...p, emp_mode: val, payroll_company: '' }))
    setErrors((p) => ({ ...p, emp_mode: undefined, payroll_company: undefined }))
  }

  // Uploads to a path independent of any candidate ID — at this point in the
  // flow no candidate row exists yet, and generating one early to get an
  // ID would burn a sequence number for candidates that never get created
  // (the exact problem 20260713020000_atomic_candidate_insert.sql fixed).
  async function uploadResume(file) {
    const token = ++resumeUploadTokenRef.current
    setResumeUploadStatus('uploading')
    setResumeUploadError('')

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const filePath = `pending/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('resumes').upload(filePath, file)

    if (token !== resumeUploadTokenRef.current) return // superseded by a newer file selection

    if (uploadError) {
      setResumeUploadStatus('error')
      setResumeUploadError(uploadError.message || 'Resume upload failed')
      return
    }

    const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(filePath)
    setResumeUploadPath(filePath)
    setResumeUploadUrl(urlData.publicUrl)
    setResumeUploadStatus('done')
  }

  function handleResumeFileChange(file) {
    const previousPath = resumeUploadPath
    resumeUploadTokenRef.current++ // invalidate any upload already in flight

    setResumeFile(file)
    setErrors((p) => ({ ...p, resume: undefined }))
    setResumeUploadPath(null)
    setResumeUploadUrl(null)
    setResumeUploadError('')
    setResumeUploadStatus(file ? 'uploading' : 'idle')

    if (previousPath) {
      supabase.storage.from('resumes').remove([previousPath]).catch(() => {}) // best-effort cleanup, not user-facing
    }
    if (file) uploadResume(file)
  }

  async function submitCandidate(force = false) {
    const errs = validate(form, { status: resumeUploadStatus, url: resumeUploadUrl })
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setTimeout(() => {
        document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return { success: false, reason: 'validation' }
    }

    const { data: { user } } = await supabase.auth.getUser()
    const recruiter_id = user.id

    // Hard block: same user already added a matching candidate today. No force override.
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { data: ownDupes } = await supabase
      .from('candidates')
      .select('id, name, email, phone, mandate_candidates(stage, status, mandate_id, mandates(id, title))')
      .eq('recruiter_id', recruiter_id)
      .gte('created_at', startOfToday.toISOString())
      .or(`email.eq.${form.email.trim()},phone.eq.${form.phone.trim()}`)

    if (ownDupes?.length > 0) {
      setDuplicates({ items: ownDupes, blocking: true })
      return { success: false, reason: 'same_day_duplicate' }
    }

    if (!force) {
      const { data: dupes } = await supabase
        .from('candidates')
        .select('id, name, email, phone, mandate_candidates(stage, status, mandate_id, mandates(id, title))')
        .or(`email.eq.${form.email.trim()},phone.eq.${form.phone.trim()}`)

      if (dupes?.length > 0) {
        setDuplicates({ items: dupes, blocking: false })
        return { success: false, reason: 'duplicates' }
      }
    }

    setDuplicates(null)
    setSubmitting(true)
    setFormError('')

    const payload = {
      recruiter_id:  recruiter_id,
      // Identity
      name:          form.name.trim(),
      email:         form.email.trim().toLowerCase(),
      phone:         form.phone.trim(),
      alt_contact:   form.alt_contact.trim() || null,
      // Location
      current_location:    form.current_location.trim(),
      hometown:            form.hometown.trim(),
      preferred_location:  form.preferred_location.trim(),
      willing_to_relocate: form.willing_to_relocate,
      // Professional
      current_company: form.current_company.trim(),
      skill_role:      form.skill_role.trim(),
      emp_mode:        form.emp_mode || null,
      payroll_company: form.emp_mode === 'Contract' ? form.payroll_company.trim() : null,
      total_exp:       parseFloat(form.total_exp),
      relevant_exp:    parseFloat(form.relevant_exp),
      education:       form.education,
      year_of_passing: parseInt(form.year_of_passing, 10),
      // Compensation
      current_ctc:  parseFloat(form.current_ctc),
      ctc_breakup:  (form.ctc_breakup_fixed || form.ctc_breakup_variable)
        ? JSON.stringify({
            fixed:    form.ctc_breakup_fixed    !== '' ? parseFloat(form.ctc_breakup_fixed)    : null,
            variable: form.ctc_breakup_variable !== '' ? parseFloat(form.ctc_breakup_variable) : null,
          })
        : null,
      expected_ctc_min: parseFloat(form.expected_ctc_min),
      expected_ctc_max: parseFloat(form.expected_ctc_max),
      // Availability
      notice_period: form.notice_period,
      lwd:           form.lwd || null,
      dob:           form.dob || null,
      offers_in_hand: (form.offers_count || form.offers_details)
        ? JSON.stringify({
            count:   form.offers_count !== '' ? parseInt(form.offers_count, 10) : null,
            details: form.offers_details.trim() || null,
          })
        : null,
      // Additional
      linkedin_url:       form.linkedin_url.trim() || null,
      languages_known:    form.languages_known.trim() || null,
      reason_for_looking: form.reason_for_looking.trim() || null,
      source:             form.source,
      comments:           form.comments.trim() || null,
      // The resume is already fully uploaded by this point (Submit is
      // disabled until resumeUploadStatus === 'done'), so its URL goes into
      // the same insert as everything else — create_candidate() rejects the
      // row server-side if this is missing, so there's no window where a
      // candidate can exist without one.
      resume_url: resumeUploadUrl,
    }

    const { data: newCandidate, error: insertError } = await supabase.rpc('create_candidate', { payload })

    if (insertError || !newCandidate) {
      setFormError(insertError?.message || 'Could not save candidate. Please try again.')
      setSubmitting(false)
      return { success: false, reason: 'insert' }
    }

    const addedId   = newCandidate.id
    const addedName = form.name.trim()
    setForm(INITIAL)
    setErrors({})
    setResumeFile(null)
    setResumeUploadStatus('idle')
    setResumeUploadError('')
    setResumeUploadPath(null)
    setResumeUploadUrl(null)
    setFileKey((k) => k + 1)
    setSubmitting(false)
    setPostAdd({ id: addedId, name: addedName })
    return { success: true }
  }

  function handleSubmit(e) {
    e.preventDefault()
    submitCandidate(false)
  }

  function handleUseExisting(candidate) {
    setDuplicates(null)
    navigate('/pipeline', { state: { openCandidateId: candidate.id } })
  }

  function handleAssigned(appId) {
    setAssignTarget(null)
    setAppIdToast(appId)
    setTimeout(() => setAppIdToast(''), 4000)
  }

  return (
    <AppShell title="Add Candidate">
      <div className="max-w-3xl mx-auto px-6 py-6 pb-16">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* ── Identity ── */}
          <FormSection title="Identity">
            <FormField label="Candidate ID">
              <input value="Assigned on submit" readOnly className={inputReadOnly} />
            </FormField>
            <FormField label="Date added">
              <input value={today} readOnly className={inputReadOnly} />
            </FormField>
            <FormField label="Full name" required error={errors.name}>
              <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Priya Sharma" className={inputCls(errors.name)} />
            </FormField>
            <FormField label="Email" required error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="priya@example.com" className={inputCls(errors.email)} />
            </FormField>
            <FormField label="Phone" required error={errors.phone}>
              <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="9876543210" maxLength={10} className={inputCls(errors.phone)} />
            </FormField>
            <FormField label="Alternative contact" error={errors.alt_contact}>
              <input type="tel" value={form.alt_contact} onChange={(e) => setField('alt_contact', e.target.value)} placeholder="Optional" className={inputCls(errors.alt_contact)} />
            </FormField>
          </FormSection>

          {/* ── Location ── */}
          <FormSection title="Location">
            <FormField label="Current location" required error={errors.current_location}>
              <input type="text" value={form.current_location} onChange={(e) => setField('current_location', e.target.value)} placeholder="Bengaluru" className={inputCls(errors.current_location)} />
            </FormField>
            <FormField label="Hometown" required error={errors.hometown}>
              <input type="text" value={form.hometown} onChange={(e) => setField('hometown', e.target.value)} placeholder="Bengaluru" className={inputCls(errors.hometown)} />
            </FormField>
            <FormField label="Preferred location" required error={errors.preferred_location}>
              <input type="text" value={form.preferred_location} onChange={(e) => setField('preferred_location', e.target.value)} placeholder="Bengaluru" className={inputCls(errors.preferred_location)} />
            </FormField>
            <FormField label="Willing to relocate">
              <div className="flex rounded-lg overflow-hidden border border-[#F0F0F4] h-9">
                <button type="button" onClick={() => setField('willing_to_relocate', true)}
                  className={`flex-1 text-sm font-medium transition ${form.willing_to_relocate ? 'bg-[#5E6AD2] text-white' : 'bg-white text-[#666] hover:bg-[#F5F5F8]'}`}>Yes</button>
                <button type="button" onClick={() => setField('willing_to_relocate', false)}
                  className={`flex-1 text-sm font-medium transition ${!form.willing_to_relocate ? 'bg-[#5E6AD2] text-white' : 'bg-white text-[#666] hover:bg-[#F5F5F8]'}`}>No</button>
              </div>
            </FormField>
          </FormSection>

          {/* ── Professional ── */}
          <FormSection title="Professional">
            <FormField label="Current company" required error={errors.current_company}>
              <input type="text" value={form.current_company} onChange={(e) => setField('current_company', e.target.value)} placeholder="Acme Pvt Ltd" className={inputCls(errors.current_company)} />
            </FormField>
            <FormField label="Skill / Role" required error={errors.skill_role}>
              <input type="text" value={form.skill_role} onChange={(e) => setField('skill_role', e.target.value)} placeholder="Full Stack Developer" className={inputCls(errors.skill_role)} />
            </FormField>
            <FormField label="Mode of employment" error={errors.emp_mode}>
              <Select value={form.emp_mode} onChange={handleModeChange} error={errors.emp_mode} placeholder="Select mode">
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
              </Select>
            </FormField>
            <FormField label="Payroll company" error={errors.payroll_company}>
              <input
                type="text"
                value={form.payroll_company}
                onChange={(e) => setField('payroll_company', e.target.value)}
                placeholder={form.emp_mode === 'Contract' ? 'Payroll Pvt Ltd' : 'N/A'}
                disabled={form.emp_mode !== 'Contract'}
                className={`${inputCls(errors.payroll_company)} ${form.emp_mode !== 'Contract' ? 'opacity-40 cursor-not-allowed' : ''}`}
              />
            </FormField>
            <FormField label="Total experience (yrs)" required error={errors.total_exp}>
              <input type="number" min={0} step={0.5} value={form.total_exp} onChange={(e) => setField('total_exp', e.target.value)} placeholder="4.5" className={inputCls(errors.total_exp)} />
            </FormField>
            <FormField label="Relevant experience (yrs)" required error={errors.relevant_exp}>
              <input type="number" min={0} step={0.5} value={form.relevant_exp} onChange={(e) => setField('relevant_exp', e.target.value)} placeholder="3.0" className={inputCls(errors.relevant_exp)} />
            </FormField>
            <FormField label="Highest qualification" required error={errors.education}>
              <Select value={form.education} onChange={(e) => setField('education', e.target.value)} error={errors.education} placeholder="Select qualification">
                {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </Select>
            </FormField>
            <FormField label="Year of passing" required error={errors.year_of_passing}>
              <Select value={form.year_of_passing} onChange={(e) => setField('year_of_passing', e.target.value)} error={errors.year_of_passing} placeholder="Select year">
                {PASSING_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </FormField>
          </FormSection>

          {/* ── Compensation ── */}
          <FormSection title="Compensation">
            {/* Row 1: Current CTC is grouped with its Fixed/Variable breakdown */}
            <div className="col-span-2 grid grid-cols-3 gap-x-6 gap-y-5">
              <FormField label="Current CTC (LPA)" required error={errors.current_ctc}>
                <input type="number" min={0} step={0.5} value={form.current_ctc} onChange={(e) => setField('current_ctc', e.target.value)} placeholder="12.0" className={inputCls(errors.current_ctc)} />
              </FormField>
              <FormField label="Fixed (LPA)" error={errors.ctc_breakup_fixed}>
                <input type="number" min={0} step={0.5} value={form.ctc_breakup_fixed} onChange={(e) => setField('ctc_breakup_fixed', e.target.value)} placeholder="Optional" className={inputCls(errors.ctc_breakup_fixed)} />
              </FormField>
              <FormField label="Variable (LPA)" error={errors.ctc_breakup_variable}>
                <input type="number" min={0} step={0.5} value={form.ctc_breakup_variable} onChange={(e) => setField('ctc_breakup_variable', e.target.value)} placeholder="Optional" className={inputCls(errors.ctc_breakup_variable)} />
              </FormField>
            </div>
            {/* Row 2: Expected CTC as a range */}
            <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-5">
              <FormField label="Expected CTC Min (LPA)" required error={errors.expected_ctc_min}>
                <input type="number" min={0} step={0.5} value={form.expected_ctc_min} onChange={(e) => setField('expected_ctc_min', e.target.value)} placeholder="12.0" className={inputCls(errors.expected_ctc_min)} />
              </FormField>
              <FormField label="Expected CTC Max (LPA)" required error={errors.expected_ctc_max}>
                <input type="number" min={0} step={0.5} value={form.expected_ctc_max} onChange={(e) => setField('expected_ctc_max', e.target.value)} placeholder="15.0" className={inputCls(errors.expected_ctc_max)} />
              </FormField>
            </div>
          </FormSection>

          {/* ── Availability ── */}
          <FormSection title="Availability">
            <FormField label="Notice period" required error={errors.notice_period}>
              <Select value={form.notice_period} onChange={(e) => setField('notice_period', e.target.value)} error={errors.notice_period} placeholder="Select notice period">
                {NOTICE_PERIODS.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </FormField>
            <FormField label="Last working day" error={errors.lwd}>
              <input type="date" value={form.lwd} onChange={(e) => setField('lwd', e.target.value)} className={inputCls(errors.lwd)} />
            </FormField>
            <FormField label="Offers in hand (#)" error={errors.offers_count}>
              <input type="number" min={0} step={1} value={form.offers_count} onChange={(e) => setField('offers_count', e.target.value)} placeholder="0" className={inputCls(errors.offers_count)} />
            </FormField>
            <FormField label="Offer details" error={errors.offers_details}>
              <input type="text" value={form.offers_details} onChange={(e) => setField('offers_details', e.target.value)} placeholder="Company X – 18L" className={inputCls(errors.offers_details)} />
            </FormField>
          </FormSection>

          {/* ── Additional ── */}
          <FormSection title="Additional">
            <FormField label="Date of birth" error={errors.dob}>
              <input type="date" value={form.dob} onChange={(e) => setField('dob', e.target.value)} className={inputCls(errors.dob)} />
            </FormField>
            <FormField label="LinkedIn URL" error={errors.linkedin_url}>
              <input type="url" value={form.linkedin_url} onChange={(e) => setField('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/…" className={inputCls(errors.linkedin_url)} />
            </FormField>
            <FormField label="Languages known" error={errors.languages_known}>
              <input type="text" value={form.languages_known} onChange={(e) => setField('languages_known', e.target.value)} placeholder="English, Hindi, Kannada" className={inputCls(errors.languages_known)} />
            </FormField>
            <FormField label="Reason for looking" error={errors.reason_for_looking} className="col-span-2">
              <textarea value={form.reason_for_looking} onChange={(e) => setField('reason_for_looking', e.target.value)} rows={2} placeholder="Why is the candidate looking?" className={`${inputCls(errors.reason_for_looking)} h-auto py-2 resize-none`} />
            </FormField>
            <FormField label="Source" required error={errors.source}>
              <Select value={form.source} onChange={(e) => setField('source', e.target.value)} error={errors.source} placeholder="Select source">
                {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>
            <FormField label="Assigned recruiter">
              <input value={profile?.name ?? '…'} readOnly className={inputReadOnly} />
            </FormField>
            <FormField label="Comments" error={errors.comments} className="col-span-2">
              <textarea value={form.comments} onChange={(e) => setField('comments', e.target.value)} rows={3} placeholder="Any notes about the candidate…" className={`${inputCls(errors.comments)} h-auto py-2 resize-none`} />
            </FormField>
            <FormField label="Resume" required error={errors.resume} className="col-span-2">
              <input
                key={fileKey}
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => handleResumeFileChange(e.target.files[0] ?? null)}
              />
              <div className="flex items-center gap-3 h-9">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`h-9 px-3 rounded-lg border flex items-center gap-2 text-sm transition shrink-0 ${
                    errors.resume
                      ? 'border-[#D93025] text-[#D93025] hover:border-[#D93025] hover:text-[#D93025]'
                      : 'border-[#F0F0F4] text-[#666] hover:border-[#5E6AD2] hover:text-[#5E6AD2]'
                  }`}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                    <path d="M3 12V4a1 1 0 011-1h5l3 3v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
                    <path d="M9 3v3h3M6 9h4M8 7v4" strokeLinecap="round" />
                  </svg>
                  Choose file
                </button>
                <span className="text-sm text-[#999] truncate">{resumeFile ? resumeFile.name : '.pdf, .doc, .docx'}</span>
              </div>
              {resumeUploadStatus === 'uploading' && (
                <p className="text-xs text-[#5E6AD2] mt-1.5 flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 animate-spin shrink-0">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                    <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Uploading resume…
                </p>
              )}
              {resumeUploadStatus === 'error' && (
                <p className="text-xs text-[#D93025] mt-1.5">
                  {resumeUploadError || 'Resume upload failed'}{' '}
                  <button type="button" onClick={() => resumeFile && uploadResume(resumeFile)} className="underline hover:no-underline">
                    Retry
                  </button>
                </p>
              )}
              {resumeUploadStatus === 'done' && (
                <p className="text-xs text-green-700 mt-1.5">Resume uploaded</p>
              )}
            </FormField>
          </FormSection>

          {/* Form-level error */}
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#D93025]">
              {formError}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || resumeUploadStatus === 'uploading' || resumeUploadStatus === 'error'}
              className="h-10 px-6 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#5E6AD2' }}
            >
              {submitting ? 'Saving…' : resumeUploadStatus === 'uploading' ? 'Uploading resume…' : 'Add candidate'}
            </button>
          </div>
        </form>
      </div>

      <DuplicateModal
        data={duplicates}
        submittedName={form.name.trim()}
        onCancel={() => setDuplicates(null)}
        onProceed={() => submitCandidate(true)}
        onUseExisting={handleUseExisting}
      />

      <PostAddPromptModal
        candidateId={postAdd?.id}
        onAssign={() => { setAssignTarget(postAdd); setPostAdd(null) }}
        onSkip={() => setPostAdd(null)}
      />

      {assignTarget && (
        <AssignMandateModal
          candidateId={assignTarget.id}
          candidateName={assignTarget.name}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
      )}

      <SuccessToast
        message={appIdToast ? `Assigned as ${appIdToast}` : null}
        onDismiss={() => setAppIdToast('')}
      />
    </AppShell>
  )
}
