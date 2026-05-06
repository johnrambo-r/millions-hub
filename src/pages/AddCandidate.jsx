import { useEffect, useRef, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import FormSection from '../components/add-candidate/FormSection'
import FormField, { inputCls, inputReadOnly } from '../components/add-candidate/FormField'
import DuplicateModal from '../components/add-candidate/DuplicateModal'
import SuccessToast from '../components/add-candidate/SuccessToast'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { useClients } from '../hooks/useClients'
import { useNextCandidateId } from '../hooks/useNextCandidateId'
import { supabase } from '../lib/supabase'
import {
  QUALIFICATIONS, NOTICE_PERIODS, STAGES, STAGE_STATUS_MAP, PASSING_YEARS,
} from '../lib/candidateConstants'

// ─── helpers ───────────────────────────────────────────────────────────────

const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// Form state keys match DB column names exactly
const INITIAL = {
  name: '', email: '', phone: '', alt_contact: '',
  current_location: '', preferred_location: '',
  education: '', year_of_passing: '',
  current_company: '', skill_role: '',
  total_exp: '', relevant_exp: '',
  emp_mode: '', payroll_company: '', notice_period: '',
  current_ctc: '', expected_ctc: '',
  client_id: '', stage: '', status: '',
  interview_date: '', interview_time: '', comments: '',
}

function validate(f) {
  const e = {}
  if (!f.name.trim())             e.name = 'Required'
  if (!f.email.trim())            e.email = 'Required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email'
  if (!f.phone.trim())            e.phone = 'Required'
  else if (!/^\d{10}$/.test(f.phone.trim())) e.phone = 'Must be exactly 10 digits'
  if (!f.current_location.trim()) e.current_location = 'Required'
  if (!f.education)               e.education = 'Required'
  if (!f.year_of_passing)         e.year_of_passing = 'Required'
  if (!f.current_company.trim())  e.current_company = 'Required'
  if (!f.skill_role.trim())       e.skill_role = 'Required'
  if (f.total_exp === '')         e.total_exp = 'Required'
  if (f.relevant_exp === '')      e.relevant_exp = 'Required'
  if (!f.emp_mode)                e.emp_mode = 'Required'
  if (f.emp_mode === 'Contract' && !f.payroll_company.trim())
                                  e.payroll_company = 'Required for contract'
  if (!f.notice_period)           e.notice_period = 'Required'
  if (f.current_ctc === '')       e.current_ctc = 'Required'
  if (f.expected_ctc === '')      e.expected_ctc = 'Required'
  if (!f.client_id)               e.client_id = 'Required'
  if (!f.stage)                   e.stage = 'Required'
  if (!f.status)                  e.status = 'Required'
  return e
}

// ─── select component ──────────────────────────────────────────────────────

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

// ─── page ──────────────────────────────────────────────────────────────────

export default function AddCandidate() {
  const { session } = useAuth()
  const profile = useProfile()
  const clients = useClients()
  const { candidateId, regenerate } = useNextCandidateId()

  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [duplicates, setDuplicates] = useState(null)
  const [toast, setToast] = useState('')
  const [resumeFile, setResumeFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const fileInputRef = useRef(null)
  const [formError, setFormError] = useState('')

  const isDirty = Object.keys(INITIAL).some((key) => form[key] !== INITIAL[key]) || !!resumeFile

  useEffect(() => {
    if (isDirty) {
      window.onbeforeunload = () => true
    } else {
      window.onbeforeunload = null
    }
    return () => { window.onbeforeunload = null }
  }, [isDirty])

  function setField(key, value) {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  function handleStageChange(e) {
    setForm((p) => ({ ...p, stage: e.target.value, status: '' }))
    setErrors((p) => ({ ...p, stage: undefined, status: undefined }))
  }

  function handleModeChange(e) {
    const val = e.target.value
    setForm((p) => ({ ...p, emp_mode: val, payroll_company: '' }))
    setErrors((p) => ({ ...p, emp_mode: undefined, payroll_company: undefined }))
  }

  async function submitCandidate(force = false) {
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setTimeout(() => {
        document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return { success: false, reason: 'validation' }
    }

    // Duplicate check
    if (!force) {
      const { data: dupes } = await supabase
        .from('candidates')
        .select('id, name, email, phone, stage, status')
        .or(`email.eq.${form.email.trim()},phone.eq.${form.phone.trim()}`)

      if (dupes?.length > 0) {
        setDuplicates(dupes)
        return { success: false, reason: 'duplicates' }
      }
    }

    setDuplicates(null)
    setSubmitting(true)
    setFormError('')

    // Upload resume first so the public URL can go into the insert payload
    let publicUrl = null
    if (resumeFile) {
      const filePath = `${candidateId}/${resumeFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, resumeFile)

      if (uploadError) {
        console.warn('[AddCandidate] resume upload failed:', uploadError.message)
      } else {
        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(filePath)
        publicUrl = urlData.publicUrl
      }
    }

    const now = new Date().toISOString()
    const payload = {
      id:                 candidateId,
      name:               form.name.trim(),
      email:              form.email.trim().toLowerCase(),
      phone:              form.phone.trim(),
      alt_contact:        form.alt_contact.trim() || null,
      current_location:   form.current_location.trim(),
      preferred_location: form.preferred_location.trim() || null,
      education:          form.education,
      year_of_passing:    parseInt(form.year_of_passing, 10),
      current_company:    form.current_company.trim(),
      skill_role:         form.skill_role.trim(),
      total_exp:          parseFloat(form.total_exp),
      relevant_exp:       parseFloat(form.relevant_exp),
      emp_mode:           form.emp_mode,
      payroll_company:    form.emp_mode === 'Contract' ? form.payroll_company.trim() : null,
      notice_period:      form.notice_period,
      current_ctc:        parseFloat(form.current_ctc),
      expected_ctc:       parseFloat(form.expected_ctc),
      client_id:          form.client_id,
      recruiter_id:       session.user.id,
      stage:              form.stage,
      status:             form.status,
      interview_date:     form.interview_date || null,
      interview_time:     form.interview_time || null,
      comments:           form.comments.trim() || null,
      status_changed_at:  now,
      resume_url:         publicUrl,
    }

    console.log('[AddCandidate] publicUrl:', publicUrl)

    const { data: inserted, error: insertError } = await supabase
      .from('candidates')
      .insert(payload)
      .select('id')
      .single()

    if (insertError) {
      setFormError(insertError.message)
      setSubmitting(false)
      return { success: false, reason: 'insert' }
    }

    // First status history row
    const { error: histError } = await supabase.from('status_history').insert({
      candidate_id: inserted.id,
      stage:        form.stage,
      status:       form.status,
      notes:        form.comments.trim() || null,
      changed_by:   session.user.id,
      changed_at:   now,
    })
    if (histError) console.error('[AddCandidate] status_history insert:', histError.message)

    // Reset
    const addedId = candidateId
    setForm(INITIAL)
    setErrors({})
    setResumeFile(null)
    setFileKey((k) => k + 1)
    await regenerate()
    setSubmitting(false)

    setToast(addedId)
    setTimeout(() => setToast(''), 4000)
    return { success: true }
  }

  function handleSubmit(e) {
    e.preventDefault()
    submitCandidate(false)
  }

  const statusOptions = form.stage ? (STAGE_STATUS_MAP[form.stage] ?? []) : []

  return (
    <AppShell title="Add Candidate">
      <div className="max-w-3xl mx-auto px-6 py-6 pb-16">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* ── Section 1: Personal details ── */}
          <FormSection title="Personal details">
            <FormField label="Candidate ID">
              <input value={candidateId || 'Generating…'} readOnly className={inputReadOnly} />
            </FormField>

            <FormField label="Date added">
              <input value={today} readOnly className={inputReadOnly} />
            </FormField>

            <FormField label="Full name" required error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Priya Sharma"
                className={inputCls(errors.name)}
              />
            </FormField>

            <FormField label="Email" required error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="priya@example.com"
                className={inputCls(errors.email)}
              />
            </FormField>

            <FormField label="Phone" required error={errors.phone}>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="9876543210"
                maxLength={10}
                className={inputCls(errors.phone)}
              />
            </FormField>

            <FormField label="Alternative contact" error={errors.alt_contact}>
              <input
                type="tel"
                value={form.alt_contact}
                onChange={(e) => setField('alt_contact', e.target.value)}
                placeholder="Optional"
                className={inputCls(errors.alt_contact)}
              />
            </FormField>

            <FormField label="Current location" required error={errors.current_location}>
              <input
                type="text"
                value={form.current_location}
                onChange={(e) => setField('current_location', e.target.value)}
                placeholder="Bengaluru"
                className={inputCls(errors.current_location)}
              />
            </FormField>

            <FormField label="Preferred location" error={errors.preferred_location}>
              <input
                type="text"
                value={form.preferred_location}
                onChange={(e) => setField('preferred_location', e.target.value)}
                placeholder="Optional"
                className={inputCls(errors.preferred_location)}
              />
            </FormField>
          </FormSection>

          {/* ── Section 2: Education ── */}
          <FormSection title="Education">
            <FormField label="Highest qualification" required error={errors.education}>
              <Select
                value={form.education}
                onChange={(e) => setField('education', e.target.value)}
                error={errors.education}
                placeholder="Select qualification"
              >
                {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </Select>
            </FormField>

            <FormField label="Year of passing" required error={errors.year_of_passing}>
              <Select
                value={form.year_of_passing}
                onChange={(e) => setField('year_of_passing', e.target.value)}
                error={errors.year_of_passing}
                placeholder="Select year"
              >
                {PASSING_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </FormField>
          </FormSection>

          {/* ── Section 3: Experience & employment ── */}
          <FormSection title="Experience and employment">
            <FormField label="Current company" required error={errors.current_company}>
              <input
                type="text"
                value={form.current_company}
                onChange={(e) => setField('current_company', e.target.value)}
                placeholder="Acme Pvt Ltd"
                className={inputCls(errors.current_company)}
              />
            </FormField>

            <FormField label="Skill / Role" required error={errors.skill_role}>
              <input
                type="text"
                value={form.skill_role}
                onChange={(e) => setField('skill_role', e.target.value)}
                placeholder="Full Stack Developer"
                className={inputCls(errors.skill_role)}
              />
            </FormField>

            <FormField label="Total experience (yrs)" required error={errors.total_exp}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.total_exp}
                onChange={(e) => setField('total_exp', e.target.value)}
                placeholder="4.5"
                className={inputCls(errors.total_exp)}
              />
            </FormField>

            <FormField label="Relevant experience (yrs)" required error={errors.relevant_exp}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.relevant_exp}
                onChange={(e) => setField('relevant_exp', e.target.value)}
                placeholder="3.0"
                className={inputCls(errors.relevant_exp)}
              />
            </FormField>

            <FormField label="Mode of employment" required error={errors.emp_mode}>
              <Select
                value={form.emp_mode}
                onChange={handleModeChange}
                error={errors.emp_mode}
                placeholder="Select mode"
              >
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
              </Select>
            </FormField>

            {form.emp_mode === 'Contract' && (
              <FormField label="Payroll company" required error={errors.payroll_company}>
                <input
                  type="text"
                  value={form.payroll_company}
                  onChange={(e) => setField('payroll_company', e.target.value)}
                  placeholder="Payroll Pvt Ltd"
                  className={inputCls(errors.payroll_company)}
                />
              </FormField>
            )}

            <FormField label="Notice period" required error={errors.notice_period}>
              <Select
                value={form.notice_period}
                onChange={(e) => setField('notice_period', e.target.value)}
                error={errors.notice_period}
                placeholder="Select notice period"
              >
                {NOTICE_PERIODS.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </FormField>
          </FormSection>

          {/* ── Section 4: Compensation ── */}
          <FormSection title="Compensation">
            <FormField label="Current CTC (LPA)" required error={errors.current_ctc}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.current_ctc}
                onChange={(e) => setField('current_ctc', e.target.value)}
                placeholder="12.0"
                className={inputCls(errors.current_ctc)}
              />
            </FormField>

            <FormField label="Expected CTC (LPA)" required error={errors.expected_ctc}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.expected_ctc}
                onChange={(e) => setField('expected_ctc', e.target.value)}
                placeholder="15.0"
                className={inputCls(errors.expected_ctc)}
              />
            </FormField>
          </FormSection>

          {/* ── Section 5: Recruitment details ── */}
          <FormSection title="Recruitment details">
            <FormField label="Submitted to client" required error={errors.client_id}>
              <Select
                value={form.client_id}
                onChange={(e) => setField('client_id', e.target.value)}
                error={errors.client_id}
                placeholder="Select client"
              >
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>

            <FormField label="Assigned recruiter">
              <input value={profile?.name ?? '…'} readOnly className={inputReadOnly} />
            </FormField>

            <FormField label="Stage" required error={errors.stage}>
              <Select
                value={form.stage}
                onChange={handleStageChange}
                error={errors.stage}
                placeholder="Select stage"
              >
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>

            <FormField label="Status" required error={errors.status}>
              <Select
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                error={errors.status}
                placeholder={form.stage ? 'Select status' : 'Select stage first'}
                disabled={!form.stage}
              >
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>

            <FormField label="Interview date" error={errors.interview_date}>
              <input
                type="date"
                value={form.interview_date}
                onChange={(e) => setField('interview_date', e.target.value)}
                className={inputCls(errors.interview_date)}
              />
            </FormField>

            <FormField label="Interview time" error={errors.interview_time}>
              <input
                type="time"
                value={form.interview_time}
                onChange={(e) => setField('interview_time', e.target.value)}
                className={inputCls(errors.interview_time)}
              />
            </FormField>

            <FormField label="Comments" error={errors.comments} className="col-span-2">
              <textarea
                value={form.comments}
                onChange={(e) => setField('comments', e.target.value)}
                rows={3}
                placeholder="Any notes about the candidate…"
                className={`${inputCls(errors.comments)} h-auto py-2 resize-none`}
              />
            </FormField>

            <FormField label="Resume" className="col-span-2">
              {/* hidden input — display:none keeps it fully out of layout */}
              <input
                key={fileKey}
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => setResumeFile(e.target.files[0] ?? null)}
              />
              <div className="flex items-center gap-3 h-9">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 px-3 rounded-lg border border-[#F0F0F4] flex items-center gap-2 text-sm text-[#666] hover:border-[#5E6AD2] hover:text-[#5E6AD2] transition shrink-0"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                    <path d="M3 12V4a1 1 0 011-1h5l3 3v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
                    <path d="M9 3v3h3M6 9h4M8 7v4" strokeLinecap="round" />
                  </svg>
                  Choose file
                </button>
                <span className="text-sm text-[#999] truncate">
                  {resumeFile ? resumeFile.name : '.pdf, .doc, .docx'}
                </span>
              </div>
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
              disabled={submitting || !candidateId}
              className="h-10 px-6 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#5E6AD2' }}
            >
              {submitting ? 'Saving…' : 'Add candidate'}
            </button>
          </div>
        </form>
      </div>

      <DuplicateModal
        duplicates={duplicates}
        onCancel={() => setDuplicates(null)}
        onProceed={() => submitCandidate(true)}
      />

      <SuccessToast candidateId={toast} onDismiss={() => setToast('')} />
    </AppShell>
  )
}
