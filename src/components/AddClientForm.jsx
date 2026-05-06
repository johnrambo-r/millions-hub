import { useState } from 'react'
import { supabase } from '../lib/supabase'

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

const ACCOUNT_STATUSES = ['Active', 'On Hold', 'Inactive']
const CLIENT_TYPES = ['GCC', 'Product Startup', 'IT Services', 'Consulting']

function EditField({ label, children, colSpan2 = false }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : ''}>
      <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">{label}</label>
      {children}
    </div>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin text-[#5E6AD2]" viewBox="0 0 24 24" fill="none">
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

export default function AddClientForm({ onClose, onAdded }) {
  const [form, setForm] = useState({
    name: '',
    industry: '',
    client_type: '',
    location: '',
    website: '',
    about: '',
    primary_contact_name: '',
    primary_contact_designation: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    account_status: 'Active',
    notes: '',
  })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAiLookup() {
    const companyName = form.name.trim()
    if (!companyName) {
      setAiError('Enter a company name first.')
      return
    }
    setAiLoading(true)
    setAiError('')

    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are a business research assistant. Return only valid JSON, no markdown, no explanation.'
            },
            {
              role: 'user',
              content: `Given the company name, return a JSON object with these fields:
        - industry (e.g. Banking, IT Services, Healthcare, Manufacturing)
        - client_type (one of: GCC, Product Startup, IT Services, Consulting)
        - location (city, country — HQ)
        - website (full URL)
        - about (2-3 sentence company description)
        Company name: ${companyName}`
            }
          ],
          max_tokens: 500
        })
      })

      if (!res.ok) {
        throw new Error(`DeepSeek API error: ${res.status}`)
      }

      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty response from DeepSeek')

      const parsed = JSON.parse(text)
      setForm((prev) => ({
        ...prev,
        industry:    parsed.industry    ?? prev.industry,
        client_type: parsed.client_type ?? prev.client_type,
        location:    parsed.location    ?? prev.location,
        website:     parsed.website     ?? prev.website,
        about:       parsed.about       ?? prev.about,
      }))
    } catch (err) {
      setAiError(err.message || 'AI lookup failed. Please fill in manually.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setSaveError('Company name is required.')
      return
    }

    setSaving(true)
    setSaveError('')

    const payload = {
      name:                       form.name.trim(),
      industry:                   form.industry.trim() || null,
      client_type:                form.client_type || null,
      location:                   form.location.trim() || null,
      website:                    form.website.trim() || null,
      about:                      form.about.trim() || null,
      primary_contact_name:       form.primary_contact_name.trim() || null,
      primary_contact_designation: form.primary_contact_designation.trim() || null,
      primary_contact_email:      form.primary_contact_email.trim() || null,
      primary_contact_phone:      form.primary_contact_phone.trim() || null,
      account_status:             form.account_status || 'Active',
      notes:                      form.notes.trim() || null,
    }

    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select()
      .single()

    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }

    onAdded(data)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F0F4] shrink-0">
          <h2 className="text-base font-semibold text-[#0F0F12]">Add Client</h2>
          <button
            onClick={onClose}
            className="text-[#999] hover:text-[#0F0F12] transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Company info */}
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Company</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">

              {/* Company name + AI button */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">Company Name *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => { setField('name', e.target.value); setAiError('') }}
                    className={`${fldCls} flex-1`}
                    placeholder="e.g. Infosys BPM"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleAiLookup}
                    disabled={aiLoading}
                    className="h-9 px-3.5 rounded-lg border border-[#5E6AD2] text-[#5E6AD2] text-sm font-medium flex items-center gap-1.5 hover:bg-[#5E6AD2]/5 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                  >
                    {aiLoading ? <SpinnerIcon /> : <SparkleIcon />}
                    {aiLoading ? 'Looking up…' : 'Lookup with AI'}
                  </button>
                </div>
                {aiError && (
                  <p className="text-xs text-[#D93025] mt-1.5">{aiError}</p>
                )}
              </div>

              <EditField label="Industry">
                <input
                  type="text"
                  value={form.industry}
                  onChange={(e) => setField('industry', e.target.value)}
                  className={fldCls}
                  placeholder="e.g. Banking, Healthcare"
                />
              </EditField>

              <EditField label="Client Type">
                <select value={form.client_type} onChange={(e) => setField('client_type', e.target.value)} className={fldCls}>
                  <option value="">Select type</option>
                  {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </EditField>

              <EditField label="Location">
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setField('location', e.target.value)}
                  className={fldCls}
                  placeholder="City, Country"
                />
              </EditField>

              <EditField label="Website">
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  className={fldCls}
                  placeholder="https://"
                />
              </EditField>

              <EditField label="Account Status">
                <select value={form.account_status} onChange={(e) => setField('account_status', e.target.value)} className={fldCls}>
                  {ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </EditField>

              <EditField label="About" colSpan2>
                <textarea
                  value={form.about}
                  onChange={(e) => setField('about', e.target.value)}
                  rows={3}
                  className={`${fldCls} h-auto py-2 resize-none`}
                  placeholder="Company description…"
                />
              </EditField>
            </div>
          </div>

          <hr className="border-[#F0F0F4]" />

          {/* Primary contact */}
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Primary Contact</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <EditField label="Name">
                <input type="text" value={form.primary_contact_name} onChange={(e) => setField('primary_contact_name', e.target.value)} className={fldCls} />
              </EditField>
              <EditField label="Designation">
                <input type="text" value={form.primary_contact_designation} onChange={(e) => setField('primary_contact_designation', e.target.value)} className={fldCls} />
              </EditField>
              <EditField label="Email">
                <input type="email" value={form.primary_contact_email} onChange={(e) => setField('primary_contact_email', e.target.value)} className={fldCls} />
              </EditField>
              <EditField label="Phone">
                <input type="tel" value={form.primary_contact_phone} onChange={(e) => setField('primary_contact_phone', e.target.value)} className={fldCls} />
              </EditField>
            </div>
          </div>

          <hr className="border-[#F0F0F4]" />

          {/* Notes */}
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Notes</h3>
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={3}
              className={`${fldCls} h-auto py-2 resize-none`}
              placeholder="Internal notes…"
            />
          </div>

          {saveError && (
            <p className="text-xs text-[#D93025]">{saveError}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#F0F0F4] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-9 px-5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#5E6AD2' }}
          >
            {saving ? 'Adding…' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  )
}
