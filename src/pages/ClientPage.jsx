import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { supabase } from '../lib/supabase'
import { AccountStatusBadge, ClientTypeBadge } from './Clients'
import UnsavedChangesModal from '../components/UnsavedChangesModal'
import useRole from '../hooks/useRole'
import { ACTIVE_STATUSES } from '../lib/candidateConstants'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:    'bg-green-50 text-green-700',
  on_hold:   'bg-amber-50 text-amber-700',
  closed:    'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-700',
}
const STATUS_LABELS = {
  active: 'Active', on_hold: 'On Hold', closed: 'Closed', cancelled: 'Cancelled',
}
const PRIORITY_STYLES = {
  high:   'bg-red-50 text-red-700',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-gray-100 text-gray-500',
}

const PIPELINE_STAGES     = new Set(['L2', 'L3', 'Client Onsite', 'HR'])
const INTERVIEW_OR_BEYOND = new Set(['L1', 'L2', 'L3', 'Client Onsite', 'HR', 'Offer', 'Joining'])
const ACTIVE_STATUS_SET   = new Set(ACTIVE_STATUSES)

const ACCOUNT_STATUSES = ['Active', 'On Hold', 'Inactive']
const CLIENT_TYPES     = ['GCC', 'Product Startup', 'IT Services', 'Consulting']

const EDITABLE_FIELDS = [
  'name', 'industry', 'client_type', 'location', 'website', 'about',
  'primary_contact_name', 'primary_contact_designation',
  'primary_contact_email', 'primary_contact_phone',
  'account_status', 'notes', 'account_manager_id',
]

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMoney(n) {
  if (n == null) return null
  const v = Number(n)
  if (v >= 100000) return `₹${v % 100000 === 0 ? v / 100000 : (v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${Math.round(v / 1000)}K`
  return `₹${v}`
}

function initEditFields(client) {
  const fields = {}
  EDITABLE_FIELDS.forEach((k) => { fields[k] = client?.[k] ?? '' })
  return fields
}

// ─── Small components ─────────────────────────────────────────────────────────

function Field({ label, children, colSpan2 = false }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-[#0F0F12] break-words">{children || '—'}</dd>
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

function MandateStatusBadge({ value }) {
  if (!value) return null
  const cls = STATUS_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {STATUS_LABELS[value] ?? value}
    </span>
  )
}

function PriorityBadge({ value }) {
  if (!value) return null
  const cls = PRIORITY_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  )
}

// ─── Client Summary Strip ─────────────────────────────────────────────────────

function ClientSummaryStrip({ clientId }) {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    if (!clientId) return
    supabase
      .from('mandates')
      .select('id, status, mandate_candidates(stage, status, billing_value_approx)')
      .eq('client_id', clientId)
      .then(({ data }) => {
        if (!data) return
        let activeMandates = 0, inPipeline = 0, interviews = 0, offersOut = 0, scores = 0, ir = 0
        for (const m of data) {
          if (m.status === 'active') activeMandates++
          for (const mc of (m.mandate_candidates ?? [])) {
            if (PIPELINE_STAGES.has(mc.stage) && ACTIVE_STATUS_SET.has(mc.status)) inPipeline++
            if (INTERVIEW_OR_BEYOND.has(mc.stage)) interviews++
            if (mc.stage === 'Offer' && (mc.status === 'Offer Released' || mc.status === 'Offer Accepted')) offersOut++
            const bv = Number(mc.billing_value_approx ?? 0)
            if (mc.status === 'Invoice Raised') ir += bv
            else scores += bv
          }
        }
        setMetrics({ activeMandates, inPipeline, interviews, offersOut, scores, ir })
      })
  }, [clientId])

  if (!metrics) {
    return <div className="border-b border-[#F0F0F4] bg-[#FAFAFA]" style={{ height: 58 }} />
  }

  const tiles = [
    { label: 'Active Mandates', value: metrics.activeMandates,              accent: 'text-[#0F0F12]' },
    { label: 'In Pipeline',     value: metrics.inPipeline,                  accent: 'text-violet-600' },
    { label: 'Interviews',      value: metrics.interviews,                  accent: 'text-amber-600' },
    { label: 'Offers Out',      value: metrics.offersOut,                   accent: 'text-blue-600' },
    { label: 'Scores',          value: formatMoney(metrics.scores) ?? '₹0', accent: 'text-amber-600' },
    { label: 'IR',              value: formatMoney(metrics.ir) ?? '₹0',    accent: 'text-emerald-600' },
  ]

  return (
    <div className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
      <div className="flex items-stretch overflow-x-auto">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className={`flex flex-col items-center justify-center px-5 py-3 shrink-0 ${i > 0 ? 'border-l border-[#EAEAF0]' : ''}`}
          >
            <span className={`text-2xl font-bold leading-tight tabular-nums ${t.accent}`}>{t.value}</span>
            <span className="text-[10px] font-medium text-[#999] uppercase tracking-wider mt-0.5 whitespace-nowrap">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mandate Card ─────────────────────────────────────────────────────────────

function MandateCard({ mandate }) {
  const navigate = useNavigate()
  const daysOpen = mandate.created_at
    ? Math.floor((Date.now() - new Date(mandate.created_at)) / 86400000)
    : null

  return (
    <div className="w-full rounded-lg border border-[#F0F0F4] bg-white px-4 py-3 flex items-start gap-3 text-left hover:bg-[#FAFAFA] hover:border-[#E0E0EA] transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            onClick={(e) => { e.stopPropagation(); navigate('/mandates/' + mandate.id) }}
            className="text-sm font-medium text-[#0F0F12] truncate cursor-pointer hover:text-[#5E6AD2] hover:underline"
          >{mandate.title}</span>
          {mandate.job_id && (
            <span className="font-mono text-xs text-[#999] shrink-0">{mandate.job_id}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <MandateStatusBadge value={mandate.status} />
          <PriorityBadge value={mandate.priority} />
          {mandate.location && <span className="text-xs text-[#999]">· {mandate.location}</span>}
          {mandate.num_positions && <span className="text-xs text-[#999]">· {mandate.num_positions} pos</span>}
          {daysOpen != null && <span className="text-xs text-[#999]">· {daysOpen}d open</span>}
        </div>
      </div>
      <svg
        viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        className="w-4 h-4 text-[#CCC] group-hover:text-[#999] transition-colors shrink-0 mt-0.5"
      >
        <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ─── Mandates Tab ─────────────────────────────────────────────────────────────

function MandatesTab({ clientId }) {
  const [mandates, setMandates] = useState([])
  const [loading, setLoading]   = useState(true)
  const [subTab, setSubTab]     = useState('active')

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    supabase
      .from('mandates')
      .select('id, title, job_id, status, priority, location, num_positions, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setMandates(data ?? [])
        setLoading(false)
      })
  }, [clientId])

  const activeMandates   = mandates.filter((m) => m.status === 'active')
  const inactiveMandates = mandates.filter((m) => ['on_hold', 'closed', 'cancelled'].includes(m.status))
  const list = subTab === 'active' ? activeMandates : inactiveMandates

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4">
        {[
          { key: 'active',   label: 'Active',   count: activeMandates.length },
          { key: 'inactive', label: 'Inactive', count: inactiveMandates.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`h-7 px-3 rounded-full text-xs font-medium transition ${
              subTab === key
                ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                : 'text-[#999] hover:text-[#666]'
            }`}
          >
            {label} <span className="text-[10px]">({count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#999] py-8 text-center">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[#999] py-8 text-center">No {subTab} mandates.</p>
      ) : (
        <div className="space-y-2">
          {list.map((m) => (
            <MandateCard key={m.id} mandate={m} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientPage() {
  const { id }          = useParams()
  const navigate        = useNavigate()
  const { isRecruiter } = useRole()

  const [client, setClient]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [activeTab, setActiveTab]   = useState('details')
  const [amProfiles, setAmProfiles] = useState([])

  const [isEditing, setIsEditing]     = useState(false)
  const [editFields, setEditFields]   = useState({})
  const [isDirty, setIsDirty]         = useState(false)
  const [editSaving, setEditSaving]   = useState(false)
  const [editError, setEditError]     = useState('')
  const [editSuccess, setEditSuccess] = useState(false)
  const [dialog, setDialog]           = useState(null)
  const [dialogSaving, setDialogSaving] = useState(false)

  const originalFieldsRef = useRef({})

  // Fetch client
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setFetchError('')
    supabase
      .from('clients')
      .select('*, account_manager:profiles!account_manager_id(id, name)')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setFetchError(err?.message ?? 'Client not found')
        else setClient(data)
        setLoading(false)
      })
  }, [id])

  // Fetch AM profiles for edit form
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, role')
      .in('role', ['account_manager', 'founder'])
      .eq('active', true)
      .order('name')
      .then(({ data }) => setAmProfiles(data ?? []))
  }, [])

  // Dirty guard
  useEffect(() => {
    window.onbeforeunload = isDirty ? () => true : null
    return () => { window.onbeforeunload = null }
  }, [isDirty])

  useEffect(() => {
    if (!isEditing) return
    const orig = originalFieldsRef.current
    const dirty = Object.keys(editFields).some((k) => editFields[k] !== orig[k])
    setIsDirty(dirty)
  }, [editFields, isEditing])

  // ── Edit helpers ──────────────────────────────────────────────────────────

  function resetEditState() {
    setIsEditing(false)
    setEditError('')
    setIsDirty(false)
  }

  function handleEditStart() {
    const fields = initEditFields(client)
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
          await performSave()
          setDialogSaving(false)
          setDialog(null)
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

  async function performSave() {
    setEditSaving(true)
    setEditError('')

    const payload = {}
    EDITABLE_FIELDS.forEach((k) => {
      payload[k] = editFields[k]?.trim?.() !== undefined
        ? (editFields[k].trim() || null)
        : (editFields[k] || null)
    })
    payload.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', id)
      .select('*, account_manager:profiles!account_manager_id(id, name)')
      .single()

    setEditSaving(false)

    if (error) {
      setEditError(error.message)
      return false
    }

    if (data) setClient(data)
    setIsEditing(false)
    setIsDirty(false)
    setEditSuccess(true)
    setTimeout(() => setEditSuccess(false), 3000)
    return true
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell title="Client">
        <div className="flex items-center justify-center h-64 text-sm text-[#999]">Loading…</div>
      </AppShell>
    )
  }

  if (fetchError || !client) {
    return (
      <AppShell title="Client">
        <div className="px-6 py-6">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {fetchError || 'Client not found.'}
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell title={client.name}>
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#F0F0F4] px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/clients')}
            className="flex items-center gap-1 text-sm text-[#666] hover:text-[#0F0F12] transition-colors shrink-0"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <span className="text-[#E0E0E8] select-none">|</span>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-semibold text-[#0F0F12] truncate">{client.name}</h1>
            <AccountStatusBadge value={client.account_status} />
            <ClientTypeBadge value={client.client_type} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editSuccess && <span className="text-xs text-green-600 font-medium">Saved</span>}
          {!isEditing ? (
            !isRecruiter && (
              <button
                onClick={handleEditStart}
                className="h-8 px-3 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:border-[#5E6AD2] hover:text-[#5E6AD2] transition"
              >
                Edit
              </button>
            )
          ) : (
            <>
              <button
                onClick={handleEditCancel}
                className="h-8 px-3 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition"
              >
                Cancel
              </button>
              <button
                onClick={performSave}
                disabled={editSaving}
                className="h-8 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#5E6AD2' }}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {editError && (
        <div className="mx-6 mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {editError}
        </div>
      )}

      {/* Summary strip */}
      <ClientSummaryStrip clientId={id} />

      {/* Tab bar */}
      <div className="flex border-b border-[#F0F0F4] px-6">
        {['details', 'mandates'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2.5 mr-5 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[#5E6AD2] text-[#5E6AD2]'
                : 'border-transparent text-[#999] hover:text-[#666]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab body */}
      {activeTab === 'details' && (
        <div className="px-6 pt-5 pb-8 max-w-3xl space-y-6">
          {isEditing ? (
            /* ── Edit form ─────────────────────────────────────────────── */
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Company</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <EditField label="Company name" colSpan2>
                    <input type="text" value={editFields.name || ''} onChange={(e) => setEditField('name', e.target.value)} className={fldCls} />
                  </EditField>
                  <EditField label="Industry">
                    <input type="text" value={editFields.industry || ''} onChange={(e) => setEditField('industry', e.target.value)} className={fldCls} placeholder="e.g. Banking, Healthcare" />
                  </EditField>
                  <EditField label="Client Type">
                    <select value={editFields.client_type || ''} onChange={(e) => setEditField('client_type', e.target.value)} className={fldCls}>
                      <option value="">Select type</option>
                      {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </EditField>
                  <EditField label="Location">
                    <input type="text" value={editFields.location || ''} onChange={(e) => setEditField('location', e.target.value)} className={fldCls} placeholder="City, Country" />
                  </EditField>
                  <EditField label="Website">
                    <input type="url" value={editFields.website || ''} onChange={(e) => setEditField('website', e.target.value)} className={fldCls} placeholder="https://" />
                  </EditField>
                  <EditField label="Account Status">
                    <select value={editFields.account_status || ''} onChange={(e) => setEditField('account_status', e.target.value)} className={fldCls}>
                      {ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </EditField>
                  <EditField label="Account Manager">
                    <select value={editFields.account_manager_id || ''} onChange={(e) => setEditField('account_manager_id', e.target.value)} className={fldCls}>
                      <option value="">Select AM</option>
                      {amProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </EditField>
                  <EditField label="BD Owner">
                    <input type="text" className={fldCls} placeholder="Coming soon…" disabled />
                  </EditField>
                  <EditField label="About" colSpan2>
                    <textarea
                      value={editFields.about || ''}
                      onChange={(e) => setEditField('about', e.target.value)}
                      rows={3}
                      className={`${fldCls} h-auto py-2 resize-none`}
                      placeholder="Company description…"
                    />
                  </EditField>
                </div>
              </div>

              <hr className="border-[#F0F0F4]" />

              <div>
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Primary Contact</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <EditField label="Name">
                    <input type="text" value={editFields.primary_contact_name || ''} onChange={(e) => setEditField('primary_contact_name', e.target.value)} className={fldCls} />
                  </EditField>
                  <EditField label="Designation">
                    <input type="text" value={editFields.primary_contact_designation || ''} onChange={(e) => setEditField('primary_contact_designation', e.target.value)} className={fldCls} />
                  </EditField>
                  {!isRecruiter && (
                    <EditField label="Email">
                      <input type="email" value={editFields.primary_contact_email || ''} onChange={(e) => setEditField('primary_contact_email', e.target.value)} className={fldCls} />
                    </EditField>
                  )}
                  {!isRecruiter && (
                    <EditField label="Phone">
                      <input type="tel" value={editFields.primary_contact_phone || ''} onChange={(e) => setEditField('primary_contact_phone', e.target.value)} className={fldCls} />
                    </EditField>
                  )}
                </div>
              </div>

              <hr className="border-[#F0F0F4]" />

              <div>
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Notes</h3>
                <textarea
                  value={editFields.notes || ''}
                  onChange={(e) => setEditField('notes', e.target.value)}
                  rows={4}
                  className={`${fldCls} h-auto py-2 resize-none`}
                  placeholder="Internal notes…"
                />
              </div>
            </div>
          ) : (
            /* ── Read-only details ──────────────────────────────────────── */
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Company</h3>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <Field label="Industry">{client.industry}</Field>
                  <Field label="Client Type">{client.client_type}</Field>
                  <Field label="Location">{client.location}</Field>
                  <Field label="Website">
                    {client.website ? (
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#5E6AD2] hover:underline truncate block max-w-full"
                      >
                        {client.website}
                      </a>
                    ) : null}
                  </Field>
                  <Field label="Account Status">{client.account_status}</Field>
                  <Field label="Account Manager">{client.account_manager?.name}</Field>
                  <Field label="Added">{formatDate(client.created_at)}</Field>
                  {client.about && (
                    <Field label="About" colSpan2>{client.about}</Field>
                  )}
                </dl>
              </div>

              <hr className="border-[#F0F0F4]" />

              <div>
                <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Primary Contact</h3>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <Field label="Name">{client.primary_contact_name}</Field>
                  <Field label="Designation">{client.primary_contact_designation}</Field>
                  {!isRecruiter && <Field label="Email">{client.primary_contact_email}</Field>}
                  {!isRecruiter && <Field label="Phone">{client.primary_contact_phone}</Field>}
                </dl>
              </div>

              {client.notes && (
                <>
                  <hr className="border-[#F0F0F4]" />
                  <div>
                    <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">Notes</h3>
                    <p className="text-sm text-[#666] leading-relaxed whitespace-pre-wrap">{client.notes}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'mandates' && (
        <div className="px-6 pt-5 pb-8">
          <MandatesTab clientId={id} />
        </div>
      )}

      {dialog && (
        <UnsavedChangesModal
          message={dialog.message}
          onSave={dialog.onSave}
          onDiscard={dialog.onDiscard}
          onCancel={dialog.onCancel}
          saving={dialogSaving}
        />
      )}
    </AppShell>
  )
}
