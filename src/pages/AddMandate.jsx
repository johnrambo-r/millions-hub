import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import AppShell from '../components/layout/AppShell'
import FormSection from '../components/add-candidate/FormSection'
import FormField, { inputCls } from '../components/add-candidate/FormField'
import { useClients } from '../hooks/useClients'
import { supabase } from '../lib/supabase'
import { GROQ_MODEL } from '../lib/groqConfig'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

// ─── constants ─────────────────────────────────────────────────────────────

const TABS = ['Paste Text', 'Upload JD', 'Manual']

const INITIAL = {
  title: '',
  client_id: '',
  am_id: '',
  status: 'active',
  priority: 'medium',
  num_positions: 1,
  experience_min: '',
  experience_max: '',
  location: '',
  work_mode: '',
  employment_type: '',
  budget_min: '',
  budget_max: '',
  budget_currency: 'INR',
  internal_notes: '',
  jd_text: '',
}

function validate(f) {
  const e = {}
  if (!f.title.trim()) e.title = 'Required'
  if (!f.client_id)    e.client_id = 'Required'
  if (!f.am_id)        e.am_id = 'Required'
  return e
}

// ─── small helpers ──────────────────────────────────────────────────────────

function Select({ value, onChange, error, placeholder, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={inputCls(error)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2M4.22 4.22l1.42 1.42M10.36 10.36l1.42 1.42M4.22 11.78l1.42-1.42M10.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function AddMandate() {
  const navigate = useNavigate()
  const clients = useClients()
  const fileInputRef = useRef(null)

  const [activeTab, setActiveTab] = useState(0)
  const [pasteText, setPasteText] = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [amProfiles, setAmProfiles] = useState([])
  const [recruiters, setRecruiters] = useState([])
  const [selectedRecruiters, setSelectedRecruiters] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, role')
      .in('role', ['account_manager', 'founder'])
      .eq('active', true)
      .order('name')
      .then(({ data }) => setAmProfiles(data ?? []))

    supabase
      .from('profiles')
      .select('id, name')
      .in('role', ['recruiter', 'account_manager'])
      .eq('active', true)
      .order('name')
      .then(({ data }) => setRecruiters(data ?? []))
  }, [])

  function setField(key, value) {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  function toggleRecruiter(id) {
    setSelectedRecruiters((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  async function handleExtract() {
    let content = ''

    if (activeTab === 0) {
      content = pasteText.trim()
      if (!content) { setAiError('Paste some text first.'); return }
    } else {
      if (!uploadedFile) { setAiError('Upload a file first.'); return }
      const ext = uploadedFile.name.split('.').pop().toLowerCase()
      const buffer = await uploadedFile.arrayBuffer()
      if (ext === 'pdf') {
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
        const pages = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const text = await page.getTextContent()
          pages.push(text.items.map((item) => item.str).join(' '))
        }
        content = pages.join('\n')
      } else if (ext === 'docx' || ext === 'doc') {
        const result = await mammoth.extractRawText({ arrayBuffer: buffer })
        content = result.value
      } else {
        content = new TextDecoder().decode(buffer)
      }
    }

    setAiLoading(true)
    setAiError('')

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a recruitment data extraction assistant. Extract job mandate details and return only valid JSON, no markdown, no explanation.',
            },
            {
              role: 'user',
              content: `Extract job mandate details from the following text (it may be an email, job description, or exported document with some formatting artifacts). Return a JSON object with exactly these fields:
- title (string: job title)
- location (string: city/region, or null)
- experience_min (number: minimum years of experience, or null)
- experience_max (number: maximum years of experience, or null)
- work_mode (string: one of "onsite", "hybrid", "remote", or null)
- employment_type (string: one of "full_time", "contract", "contract_to_hire", or null)
- budget_min (number: minimum budget/salary figure, or null)
- budget_max (number: maximum budget/salary figure, or null)
- budget_currency (string: currency code like "INR" or "USD", default "INR")
- jd_text (string: cleaned full job description text)

Text:
${content.slice(0, 8000)}`,
            },
          ],
          max_tokens: 1000,
        }),
      })

      if (!res.ok) throw new Error(`Groq API error: ${res.status}`)
      const data = await res.json()
      const raw = data?.choices?.[0]?.message?.content
      if (!raw) throw new Error('Empty response from AI')

      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)

      setForm((prev) => ({
        ...prev,
        title:           parsed.title           != null ? String(parsed.title)               : prev.title,
        location:        parsed.location        != null ? String(parsed.location)             : prev.location,
        experience_min:  parsed.experience_min  != null ? String(parsed.experience_min)       : prev.experience_min,
        experience_max:  parsed.experience_max  != null ? String(parsed.experience_max)       : prev.experience_max,
        work_mode:       parsed.work_mode       != null ? String(parsed.work_mode)            : prev.work_mode,
        employment_type: parsed.employment_type != null ? String(parsed.employment_type)      : prev.employment_type,
        budget_min:      parsed.budget_min      != null ? String(parsed.budget_min)           : prev.budget_min,
        budget_max:      parsed.budget_max      != null ? String(parsed.budget_max)           : prev.budget_max,
        budget_currency: parsed.budget_currency != null ? String(parsed.budget_currency)      : prev.budget_currency,
        jd_text:         parsed.jd_text         != null ? String(parsed.jd_text)              : prev.jd_text,
      }))
      setErrors({})
    } catch (err) {
      setAiError(err.message || 'AI extraction failed. Fill in the fields manually.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setTimeout(() => {
        document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }

    setSubmitting(true)
    setFormError('')

    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      title:           form.title.trim(),
      client_id:       form.client_id,
      am_id:           form.am_id,
      status:          form.status,
      priority:        form.priority,
      num_positions:   parseInt(form.num_positions, 10) || 1,
      experience_min:  form.experience_min !== '' ? parseFloat(form.experience_min) : null,
      experience_max:  form.experience_max !== '' ? parseFloat(form.experience_max) : null,
      location:        form.location.trim() || null,
      work_mode:       form.work_mode || null,
      employment_type: form.employment_type || null,
      budget_min:      form.budget_min !== '' ? parseFloat(form.budget_min) : null,
      budget_max:      form.budget_max !== '' ? parseFloat(form.budget_max) : null,
      budget_currency: form.budget_currency.trim() || 'INR',
      internal_notes:  form.internal_notes.trim() || null,
      jd_text:         form.jd_text.trim() || null,
      created_by:      user.id,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('mandates')
      .insert(payload)
      .select('id')
      .single()

    if (insertError) {
      setFormError(insertError.message)
      setSubmitting(false)
      return
    }

    if (selectedRecruiters.length > 0) {
      const rows = selectedRecruiters.map((rid) => ({
        mandate_id: inserted.id,
        recruiter_id: rid,
      }))
      const { error: rErr } = await supabase.from('mandate_recruiters').insert(rows)
      if (rErr) console.error('[AddMandate] mandate_recruiters insert:', rErr.message)
    }

    navigate('/mandates')
  }

  return (
    <AppShell title="Add Mandate">
      <div className="max-w-3xl mx-auto px-6 py-6 pb-16">

        {/* ── Intake tabs ── */}
        <div className="mb-6">
          <div className="inline-flex rounded-lg border border-[#F0F0F4] bg-[#FAFAFA] p-1 gap-1">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(i); setAiError('') }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                  activeTab === i
                    ? 'bg-white text-[#0F0F12] shadow-sm border border-[#F0F0F4]'
                    : 'text-[#666] hover:text-[#0F0F12]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* ── Tab 0: Paste Text ── */}
          {activeTab === 0 && (
            <div className="border border-[#F0F0F4] rounded-xl overflow-hidden">
              <div className="px-6 py-3.5 border-b border-[#F0F0F4] bg-[#FAFAFA]">
                <h2 className="text-xs font-semibold text-[#666] uppercase tracking-wider">Paste email or notes</h2>
              </div>
              <div className="px-6 py-5 space-y-3">
                <textarea
                  value={pasteText}
                  onChange={(e) => { setPasteText(e.target.value); setAiError('') }}
                  rows={7}
                  placeholder="Paste a job description, email, or any notes about the role here…"
                  className="w-full rounded-lg border border-[#F0F0F4] px-3 py-2 text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition resize-none"
                />
                {aiError && <p className="text-xs text-[#D93025]">{aiError}</p>}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={aiLoading || !pasteText.trim()}
                    className="h-9 px-4 rounded-lg border border-[#5E6AD2] text-[#5E6AD2] text-sm font-medium flex items-center gap-1.5 hover:bg-[#5E6AD2]/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiLoading ? <SpinnerIcon /> : <SparkleIcon />}
                    {aiLoading ? 'Extracting…' : 'Extract with AI'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 1: Upload JD ── */}
          {activeTab === 1 && (
            <div className="border border-[#F0F0F4] rounded-xl overflow-hidden">
              <div className="px-6 py-3.5 border-b border-[#F0F0F4] bg-[#FAFAFA]">
                <h2 className="text-xs font-semibold text-[#666] uppercase tracking-wider">Upload job description</h2>
              </div>
              <div className="px-6 py-5 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => { setUploadedFile(e.target.files[0] ?? null); setAiError('') }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#F0F0F4] rounded-xl p-10 flex flex-col items-center gap-3 hover:border-[#5E6AD2]/40 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-[#D0D0D8]">
                    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-5-6z" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="14 3 14 9 20 9" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="13" x2="12" y2="17" strokeLinecap="round" />
                    <line x1="10" y1="15" x2="14" y2="15" strokeLinecap="round" />
                  </svg>
                  {uploadedFile ? (
                    <span className="text-sm font-medium text-[#0F0F12]">{uploadedFile.name}</span>
                  ) : (
                    <div className="text-center">
                      <span className="text-sm text-[#666]">Click to upload</span>
                      <p className="text-xs text-[#999] mt-1">PDF, DOC, DOCX</p>
                    </div>
                  )}
                </button>
                {aiError && <p className="text-xs text-[#D93025]">{aiError}</p>}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={aiLoading || !uploadedFile}
                    className="h-9 px-4 rounded-lg border border-[#5E6AD2] text-[#5E6AD2] text-sm font-medium flex items-center gap-1.5 hover:bg-[#5E6AD2]/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiLoading ? <SpinnerIcon /> : <SparkleIcon />}
                    {aiLoading ? 'Extracting…' : 'Extract with AI'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Section: Role details ── */}
          <FormSection title="Role details">
            <FormField label="Title" required error={errors.title}>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className={inputCls(errors.title)}
              />
            </FormField>

            <FormField label="Client" required error={errors.client_id}>
              <Select
                value={form.client_id}
                onChange={(e) => setField('client_id', e.target.value)}
                error={errors.client_id}
                placeholder="Select client"
              >
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>

            <FormField label="Account Manager" required error={errors.am_id}>
              <Select
                value={form.am_id}
                onChange={(e) => setField('am_id', e.target.value)}
                error={errors.am_id}
                placeholder="Select AM"
              >
                {amProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>

            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </FormField>

            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </FormField>

            <FormField label="Number of positions">
              <input
                type="number"
                min={1}
                value={form.num_positions}
                onChange={(e) => setField('num_positions', e.target.value)}
                className={inputCls()}
              />
            </FormField>
          </FormSection>

          {/* ── Section: Requirements ── */}
          <FormSection title="Requirements">
            <FormField label="Location">
              <input
                type="text"
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="e.g. Bengaluru"
                className={inputCls()}
              />
            </FormField>

            <FormField label="Work mode">
              <Select value={form.work_mode} onChange={(e) => setField('work_mode', e.target.value)} placeholder="Select work mode">
                <option value="onsite">Onsite</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
              </Select>
            </FormField>

            <FormField label="Employment type">
              <Select value={form.employment_type} onChange={(e) => setField('employment_type', e.target.value)} placeholder="Select type">
                <option value="full_time">Full Time</option>
                <option value="contract">Contract</option>
                <option value="contract_to_hire">Contract to Hire</option>
              </Select>
            </FormField>

            {/* Experience side-by-side within the 2-col grid */}
            <div className="col-span-2 grid grid-cols-2 gap-x-6">
              <FormField label="Experience min (yrs)">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.experience_min}
                  onChange={(e) => setField('experience_min', e.target.value)}
                  placeholder="0"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Experience max (yrs)">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.experience_max}
                  onChange={(e) => setField('experience_max', e.target.value)}
                  placeholder="10"
                  className={inputCls()}
                />
              </FormField>
            </div>
          </FormSection>

          {/* ── Section: Budget ── */}
          <FormSection title="Budget">
            <div className="col-span-2 grid grid-cols-2 gap-x-6">
              <FormField label="Budget min">
                <input
                  type="number"
                  min={0}
                  value={form.budget_min}
                  onChange={(e) => setField('budget_min', e.target.value)}
                  placeholder="0"
                  className={inputCls()}
                />
              </FormField>
              <FormField label="Budget max">
                <input
                  type="number"
                  min={0}
                  value={form.budget_max}
                  onChange={(e) => setField('budget_max', e.target.value)}
                  placeholder="30"
                  className={inputCls()}
                />
              </FormField>
            </div>

            <FormField label="Budget currency">
              <input
                type="text"
                value={form.budget_currency}
                onChange={(e) => setField('budget_currency', e.target.value)}
                placeholder="INR"
                className={inputCls()}
              />
            </FormField>
          </FormSection>

          {/* ── Section: Team ── */}
          <FormSection title="Team">
            <FormField label="Assign recruiters" className="col-span-2">
              {recruiters.length === 0 ? (
                <p className="text-sm text-[#999]">No recruiters found</p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {recruiters.map((r) => {
                    const on = selectedRecruiters.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRecruiter(r.id)}
                        className={`h-8 px-3 rounded-full text-sm font-medium border transition ${
                          on
                            ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]'
                            : 'bg-white text-[#666] border-[#F0F0F4] hover:border-[#5E6AD2]/50 hover:text-[#5E6AD2]'
                        }`}
                      >
                        {r.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </FormField>
          </FormSection>

          {/* ── Section: JD & Notes ── */}
          <FormSection title="Job description and notes">
            <FormField label="JD text" className="col-span-2">
              <textarea
                value={form.jd_text}
                onChange={(e) => setField('jd_text', e.target.value)}
                rows={8}
                placeholder="Full job description…"
                className={`${inputCls()} h-auto py-2 resize-none`}
              />
            </FormField>

            <FormField label="Internal notes" className="col-span-2">
              <textarea
                value={form.internal_notes}
                onChange={(e) => setField('internal_notes', e.target.value)}
                rows={3}
                placeholder="Internal notes, context, constraints…"
                className={`${inputCls()} h-auto py-2 resize-none`}
              />
            </FormField>
          </FormSection>

          {/* Form-level error */}
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#D93025]">
              {formError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/mandates')}
              className="h-10 px-5 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-6 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#5E6AD2' }}
            >
              {submitting ? 'Saving…' : 'Add mandate'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
