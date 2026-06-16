import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { supabase } from '../lib/supabase'
import UnsavedChangesModal from '../components/UnsavedChangesModal'
import useRole from '../hooks/useRole'
import { useAuth } from '../context/AuthContext'
import {
  STAGES, STAGE_STATUS_MAP, ACTIVE_STATUSES, PLACED_STATUSES,
} from '../lib/candidateConstants'
import { InlineDropdown, StagePromptModal } from '../components/pipeline/InlineStageStatus'
import { StageBadge, StatusBadge as CandidateStatusBadge } from '../components/pipeline/StageBadge'
import { logActivity } from '../lib/activityLog'
import CandidatePanel from '../components/pipeline/CandidatePanel'
import Pagination from '../components/Pagination'

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
const WORK_MODE_LABELS  = { onsite: 'Onsite', hybrid: 'Hybrid', remote: 'Remote' }
const EMPLOYMENT_LABELS = { full_time: 'Full-time', contract: 'Contract', contract_to_hire: 'Contract to Hire' }

const EDITABLE_FIELDS = [
  'title', 'status', 'priority', 'num_positions',
  'experience_min', 'experience_max', 'location', 'work_mode',
  'employment_type', 'budget_min', 'budget_max', 'budget_currency',
  'internal_notes', 'jd_text', 'am_id',
]

const STAGE_ORDER         = Object.fromEntries(STAGES.map((s, i) => [s, i]))
const PIPELINE_STAGES     = new Set(['L2', 'L3', 'Client Onsite', 'HR'])
const INTERVIEW_OR_BEYOND = new Set(['L1', 'L2', 'L3', 'Client Onsite', 'HR', 'Offer', 'Joining'])
const INTERVIEW_STAGES    = new Set(['L1', 'L2', 'L3', 'Client Onsite', 'HR'])
const ACTIVE_STATUS_SET   = new Set(ACTIVE_STATUSES)
const PLACED_STATUS_SET   = new Set(PLACED_STATUSES)
const ALL_MC_STATUSES     = [...new Set(Object.values(STAGE_STATUS_MAP).flat())].sort()

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

const ROW_GRID = 'grid gap-x-3 px-5 py-3'
const ROW_COLS = 'grid-cols-[minmax(160px,2fr)_minmax(140px,1.5fr)_auto_auto_minmax(100px,1.5fr)_minmax(100px,1fr)_60px_100px_32px]'

const selCls = 'h-8 rounded-lg border border-[#F0F0F4] bg-white px-2.5 text-xs text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInStage(mc) {
  const ref = mc.status_changed_at ?? mc.linked_at
  if (!ref) return 0
  return Math.floor((Date.now() - new Date(ref)) / 86400000)
}

function daysColor(days) {
  if (days >= 14) return 'text-red-600 bg-red-50'
  if (days >= 7)  return 'text-amber-600 bg-amber-50'
  return 'text-[#666] bg-[#F5F5F8]'
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateShort(str) {
  if (!str) return null
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatRelDate(str) {
  if (!str) return '—'
  const days = Math.floor((Date.now() - new Date(str)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(str) {
  if (!str) return ''
  const [h, m] = str.split(':').map(Number)
  if (isNaN(h)) return str
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${period}`
}

function formatMoney(val) {
  if (val == null) return null
  const n = Number(val)
  if (n >= 100000) return `₹${n % 100000 === 0 ? n / 100000 : (n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `₹${Math.round(n / 1000)}K`
  return `₹${n}`
}

function initEditFields(mandate) {
  const fields = {}
  EDITABLE_FIELDS.forEach((k) => { fields[k] = mandate?.[k] ?? '' })
  return fields
}

// ─── Shared small components ──────────────────────────────────────────────────

function Field({ label, children, span = 1 }) {
  const spanCls = span === 2 ? 'col-span-2' : span === 3 ? 'col-span-3' : ''
  return (
    <div className={spanCls}>
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

// ─── JD collapsible ───────────────────────────────────────────────────────────

function JDTextCollapsible({ text }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return <span className="text-sm text-[#999]">—</span>
  const LIMIT = 300
  const isLong = text.length > LIMIT
  const displayed = expanded || !isLong ? text : text.slice(0, LIMIT) + '…'
  return (
    <div>
      <p className="text-sm text-[#666] whitespace-pre-wrap leading-relaxed">{displayed}</p>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="mt-1.5 text-xs text-[#5E6AD2] hover:underline">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

// ─── Link Candidate Modal ─────────────────────────────────────────────────────

function LinkCandidateModal({ mandateId, linkedIds, onLink, onClose }) {
  const [search, setSearch]       = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking]     = useState(null)

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('candidates')
        .select('id, name, skill_role, email')
        .ilike('name', `%${search}%`)
        .limit(10)
      setResults(data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  async function handleLink(candidate) {
    setLinking(candidate.id)
    const { error } = await supabase
      .from('mandate_candidates')
      .insert({ mandate_id: mandateId, candidate_id: candidate.id })
    setLinking(null)
    if (!error) onLink()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[480px] flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="px-6 py-4 border-b border-[#F0F0F4] flex items-center justify-between shrink-0">
          <h3 className="text-base font-semibold text-[#0F0F12]">Link Candidate</h3>
          <button onClick={onClose} className="text-[#999] hover:text-[#0F0F12] transition-colors">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 shrink-0">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5l3 3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by candidate name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="h-9 w-full pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {!search && <p className="text-sm text-[#999]">Type a name to search candidates.</p>}
          {searching && <p className="text-sm text-[#999]">Searching…</p>}
          {!searching && search && results.length === 0 && <p className="text-sm text-[#999]">No candidates found.</p>}
          <ul className="space-y-2">
            {results.map((c) => {
              const already = linkedIds.has(c.id)
              return (
                <li key={c.id} className="rounded-lg border border-[#F0F0F4] px-4 py-3 flex items-center justify-between gap-3 bg-[#FAFAFA]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F0F12] truncate">{c.name}</p>
                    {c.skill_role && <p className="text-xs text-[#666] mt-0.5 truncate">{c.skill_role}</p>}
                    {c.email && <p className="text-xs text-[#999] mt-0.5 truncate">{c.email}</p>}
                  </div>
                  {already ? (
                    <span className="text-xs text-[#999] shrink-0">Already linked</span>
                  ) : (
                    <button
                      onClick={() => handleLink(c)}
                      disabled={linking === c.id}
                      className="h-7 px-3 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 shrink-0"
                      style={{ backgroundColor: '#5E6AD2' }}
                    >
                      {linking === c.id ? 'Linking…' : 'Link'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Snapshot strip ────────────────────────────────────────────────────────────

function SnapshotStrip({ mandateCandidates: mcs, mandate }) {
  const snap = useMemo(() => {
    let interviews = 0, offersOut = 0, placed = 0, inPipeline = 0
    for (const mc of mcs) {
      const { stage, status } = mc
      if (INTERVIEW_OR_BEYOND.has(stage)) interviews++
      if (stage === 'Offer' && (status === 'Offer Released' || status === 'Offer Accepted')) offersOut++
      if (PLACED_STATUS_SET.has(status)) placed++
      if (PIPELINE_STAGES.has(stage) && ACTIVE_STATUS_SET.has(status)) inPipeline++
    }
    const daysOpen = mandate?.created_at
      ? Math.floor((Date.now() - new Date(mandate.created_at)) / 86400000)
      : null
    return { total: mcs.length, cvsSent: mcs.length, inPipeline, interviews, offersOut, placed, daysOpen }
  }, [mcs, mandate])

  const tiles = [
    { label: 'Total Assigned', value: snap.total,      accent: 'text-[#0F0F12]' },
    { label: 'CVs Sent',       value: snap.cvsSent,    accent: 'text-indigo-600' },
    { label: 'In Pipeline',    value: snap.inPipeline, accent: 'text-violet-600' },
    { label: 'Interviews',     value: snap.interviews,  accent: 'text-amber-600' },
    { label: 'Offers Out',     value: snap.offersOut,  accent: 'text-blue-600' },
    { label: 'Placed',         value: snap.placed,     accent: 'text-emerald-600' },
    {
      label: 'Days Open',
      value: snap.daysOpen ?? '—',
      accent: snap.daysOpen >= 60 ? 'text-red-600' : snap.daysOpen >= 30 ? 'text-amber-600' : 'text-[#0F0F12]',
    },
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

// ─── Read details ──────────────────────────────────────────────────────────────

function ReadDetails({ mandate, workingRecruiters }) {
  const expDisplay =
    mandate.experience_min != null || mandate.experience_max != null
      ? `${mandate.experience_min ?? '?'} – ${mandate.experience_max ?? '?'} yrs`
      : null

  const budgetDisplay =
    mandate.budget_min || mandate.budget_max
      ? `${mandate.budget_currency || 'INR'} ${[mandate.budget_min, mandate.budget_max]
          .filter((v) => v != null)
          .map((v) => Number(v).toLocaleString())
          .join(' – ')}`
      : null

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
      <Field label="Client">
        {mandate.client ? <span className="text-[#5E6AD2]">{mandate.client.name}</span> : null}
      </Field>
      <Field label="Role / Job ID">
        <span>{mandate.title}</span>
        {mandate.job_id && <span className="font-mono text-xs text-[#999] ml-2">{mandate.job_id}</span>}
      </Field>
      <Field label="Location">{mandate.location}</Field>
      <Field label="Experience">{expDisplay}</Field>
      <Field label="Budget">{budgetDisplay}</Field>
      <Field label="Account Manager">{mandate.am?.name}</Field>
      <Field label="Work Mode">{WORK_MODE_LABELS[mandate.work_mode] ?? mandate.work_mode}</Field>
      <Field label="Employment">{EMPLOYMENT_LABELS[mandate.employment_type] ?? mandate.employment_type}</Field>
      <Field label="Opened">{formatDate(mandate.created_at)}</Field>
      <Field label="Recruiters Working" span={3}>
        {workingRecruiters.length === 0 ? '—' : (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {workingRecruiters.map((r) => (
              <span key={r.id} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700">
                {r.name ?? r.id}
              </span>
            ))}
          </div>
        )}
      </Field>
      {mandate.internal_notes && (
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">Internal Notes</dt>
          <dd className="text-sm text-[#666] leading-relaxed whitespace-pre-wrap">{mandate.internal_notes}</dd>
        </div>
      )}
      {mandate.jd_text && (
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">Job Description</dt>
          <dd><JDTextCollapsible text={mandate.jd_text} /></dd>
        </div>
      )}
    </dl>
  )
}

// ─── Edit view ─────────────────────────────────────────────────────────────────

function EditView({ editFields, setEditField, amProfiles, recruiterProfiles, selectedRecruiters, toggleRecruiter }) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Mandate Details</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <EditField label="Title" colSpan2>
            <input type="text" value={editFields.title || ''} onChange={(e) => setEditField('title', e.target.value)} className={fldCls} placeholder="e.g. Senior Backend Engineer" />
          </EditField>
          <EditField label="Status">
            <select value={editFields.status || ''} onChange={(e) => setEditField('status', e.target.value)} className={fldCls}>
              <option value="">Select status</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </EditField>
          <EditField label="Priority">
            <select value={editFields.priority || ''} onChange={(e) => setEditField('priority', e.target.value)} className={fldCls}>
              <option value="">Select priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </EditField>
          <EditField label="Account Manager">
            <select value={editFields.am_id || ''} onChange={(e) => setEditField('am_id', e.target.value)} className={fldCls}>
              <option value="">Select AM</option>
              {amProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </EditField>
          <EditField label="Positions">
            <input type="number" min="1" value={editFields.num_positions || ''} onChange={(e) => setEditField('num_positions', e.target.value)} className={fldCls} />
          </EditField>
          <EditField label="Exp. Min (yrs)">
            <input type="number" min="0" value={editFields.experience_min ?? ''} onChange={(e) => setEditField('experience_min', e.target.value)} className={fldCls} placeholder="0" />
          </EditField>
          <EditField label="Exp. Max (yrs)">
            <input type="number" min="0" value={editFields.experience_max ?? ''} onChange={(e) => setEditField('experience_max', e.target.value)} className={fldCls} placeholder="10" />
          </EditField>
          <EditField label="Location" colSpan2>
            <input type="text" value={editFields.location || ''} onChange={(e) => setEditField('location', e.target.value)} className={fldCls} placeholder="e.g. Bengaluru, Remote" />
          </EditField>
          <EditField label="Work Mode">
            <select value={editFields.work_mode || ''} onChange={(e) => setEditField('work_mode', e.target.value)} className={fldCls}>
              <option value="">Select work mode</option>
              <option value="onsite">Onsite</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
            </select>
          </EditField>
          <EditField label="Employment Type">
            <select value={editFields.employment_type || ''} onChange={(e) => setEditField('employment_type', e.target.value)} className={fldCls}>
              <option value="">Select type</option>
              <option value="full_time">Full-time</option>
              <option value="contract">Contract</option>
              <option value="contract_to_hire">Contract to Hire</option>
            </select>
          </EditField>
          <EditField label="Budget Currency">
            <input type="text" value={editFields.budget_currency || ''} onChange={(e) => setEditField('budget_currency', e.target.value)} className={fldCls} placeholder="INR" />
          </EditField>
          <EditField label="Budget Min">
            <input type="number" min="0" value={editFields.budget_min ?? ''} onChange={(e) => setEditField('budget_min', e.target.value)} className={fldCls} />
          </EditField>
          <EditField label="Budget Max">
            <input type="number" min="0" value={editFields.budget_max ?? ''} onChange={(e) => setEditField('budget_max', e.target.value)} className={fldCls} />
          </EditField>
        </div>
      </div>

      <hr className="border-[#F0F0F4]" />

      <div>
        <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Team</h3>
        <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">Assigned Recruiters</label>
        {recruiterProfiles.length === 0 ? (
          <p className="text-sm text-[#999]">No recruiters found</p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {recruiterProfiles.map((r) => {
              const on = selectedRecruiters.includes(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRecruiter(r.id)}
                  className={`h-8 px-3 rounded-full text-sm font-medium border transition ${
                    on ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'bg-white text-[#666] border-[#F0F0F4] hover:border-[#5E6AD2]/50 hover:text-[#5E6AD2]'
                  }`}
                >
                  {r.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <hr className="border-[#F0F0F4]" />

      <div>
        <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Notes &amp; JD</h3>
        <div className="space-y-5">
          <EditField label="Internal Notes">
            <textarea value={editFields.internal_notes || ''} onChange={(e) => setEditField('internal_notes', e.target.value)} rows={3} className={`${fldCls} h-auto py-2 resize-none`} placeholder="Internal notes…" />
          </EditField>
          <EditField label="Job Description">
            <textarea value={editFields.jd_text || ''} onChange={(e) => setEditField('jd_text', e.target.value)} rows={8} className={`${fldCls} h-auto py-2 resize-none`} placeholder="Paste or type the JD…" />
          </EditField>
        </div>
      </div>
    </div>
  )
}

// ─── Candidate table row ──────────────────────────────────────────────────────

function CandidateTableRow({ mc, onRefresh, onRowClick, canEdit, mandate }) {
  const { session }         = useAuth()
  const [stage, setStage]   = useState(mc.stage ?? '')
  const [status, setStatus] = useState(mc.status ?? '')
  const [unlinkConfirm, setUnlinkConfirm] = useState(false)
  const [unlinking, setUnlinking]         = useState(false)
  const [saving, setSaving]               = useState(false)
  const [prompt, setPrompt]               = useState(null)

  const statusOptions = stage ? (STAGE_STATUS_MAP[stage] ?? []) : []
  const changedBy     = session?.user?.id
  const days          = daysInStage(mc)
  const colorCls      = daysColor(days)

  const hasInterview = mc.interview_date && INTERVIEW_STAGES.has(stage)
  const interviewStr = hasInterview
    ? [formatDateShort(mc.interview_date), mc.interview_time ? formatTime(mc.interview_time) : null].filter(Boolean).join(' · ')
    : null
  const ctcStr     = formatMoney(mc.offered_ctc)
  const billingStr = formatMoney(mc.billing_value_approx)
  const dojStr     = mc.date_of_joining ? formatDateShort(mc.date_of_joining) : null
  const hasDetails = interviewStr || ctcStr || billingStr || dojStr

  async function save(updates) {
    setSaving(true)
    await supabase.from('mandate_candidates').update(updates).eq('id', mc.id)
    setSaving(false)
  }

  async function handleStageChange(newStage) {
    const oldStage  = stage
    const oldStatus = status
    const newStatus = STAGE_STATUS_MAP[newStage]?.[0] ?? null
    setStage(newStage)
    setStatus(newStatus ?? '')
    await save({ stage: newStage, status: newStatus, status_changed_at: new Date().toISOString() })
    await logActivity({ candidateId: mc.candidate_id, mandateId: mc.mandate_id, applicantId: mc.applicant_id, changedBy, changeType: 'stage', oldValue: oldStage, newValue: newStage })
    if (oldStatus !== newStatus) {
      await logActivity({ candidateId: mc.candidate_id, mandateId: mc.mandate_id, applicantId: mc.applicant_id, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
    }
    if (INTERVIEW_STAGES.has(newStage))  setPrompt({ type: 'interview' })
    else if (newStage === 'Offer')   setPrompt({ type: 'offer' })
    else if (newStage === 'Joining') setPrompt({ type: 'joining' })
    else onRefresh()
  }

  async function handleStatusChange(newStatus) {
    const oldStatus = status
    setStatus(newStatus)
    await save({ status: newStatus, status_changed_at: new Date().toISOString() })
    await logActivity({ candidateId: mc.candidate_id, mandateId: mc.mandate_id, applicantId: mc.applicant_id, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
    onRefresh()
  }

  async function handleUnlink() {
    setUnlinking(true)
    await supabase.from('mandate_candidates').delete().eq('id', mc.id)
    setUnlinking(false)
    onRefresh()
  }

  if (unlinkConfirm) {
    return (
      <div className={`${ROW_GRID} ${ROW_COLS} border-b border-[#F0F0F4] items-center`}>
        <div className="col-span-9 flex items-center gap-3">
          <p className="text-sm text-[#0F0F12] flex-1 min-w-0 truncate">
            Unlink <span className="font-medium">{mc.candidate?.name ?? 'this candidate'}</span>?
          </p>
          <button
            onClick={handleUnlink}
            disabled={unlinking}
            className="h-7 px-3 rounded-lg text-xs font-semibold text-white bg-red-600 hover:opacity-90 disabled:opacity-50 transition shrink-0"
          >
            {unlinking ? 'Unlinking…' : 'Confirm'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setUnlinkConfirm(false) }}
            disabled={unlinking}
            className="h-7 px-3 rounded-lg text-xs font-medium border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition shrink-0"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={`${ROW_GRID} ${ROW_COLS} border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors group items-start cursor-pointer`}
        onClick={() => onRowClick(mc.candidate_id)}
      >
        {/* Col 1: Candidate name + applicant ID */}
        <div className="min-w-0 py-0.5">
          <p className="text-sm font-medium text-[#0F0F12] truncate">{mc.candidate?.name ?? '—'}</p>
          <p className="text-xs text-[#999] mt-0.5 font-mono">{mc.applicant_id ?? '—'}</p>
        </div>

        {/* Col 2: Contact */}
        <div className="min-w-0 py-0.5">
          <p className="text-xs text-[#666] truncate">{mc.candidate?.email ?? '—'}</p>
          {mc.candidate?.phone && <p className="text-xs text-[#666] mt-0.5 truncate">{mc.candidate.phone}</p>}
        </div>

        {/* Col 3: Stage */}
        <div className="py-0.5">
          <InlineDropdown
            badge={<StageBadge value={stage || null} />}
            options={STAGES}
            onSelect={handleStageChange}
            disabled={!canEdit}
          />
        </div>

        {/* Col 4: Status */}
        <div className="py-0.5">
          <InlineDropdown
            badge={<CandidateStatusBadge value={status || null} />}
            options={statusOptions}
            onSelect={handleStatusChange}
            disabled={!canEdit || !stage}
          />
        </div>

        {/* Col 5: Contextual details */}
        <div className="min-w-0 space-y-0.5 py-0.5">
          {interviewStr && (
            <p className="text-xs text-[#555] truncate">
              <span className="text-[#999] mr-1">Interview</span>{interviewStr}
            </p>
          )}
          {ctcStr && (
            <p className="text-xs text-[#555]">
              <span className="text-[#999] mr-1">CTC</span>{ctcStr}
            </p>
          )}
          {billingStr && (
            <p className="text-xs text-[#555]">
              <span className="text-[#999] mr-1">Billing</span>{billingStr}
            </p>
          )}
          {dojStr && (
            <p className="text-xs text-[#555]">
              <span className="text-[#999] mr-1">DOJ</span>{dojStr}
            </p>
          )}
          {!hasDetails && <span className="text-xs text-[#DDD]">—</span>}
        </div>

        {/* Col 6: Recruiter · AM */}
        <div className="min-w-0 py-0.5">
          <p className="text-xs text-[#666] truncate">{mc.linked_by_profile?.name ?? '—'}</p>
          <p className="text-xs text-[#999] mt-0.5 truncate">{mandate?.am?.name ?? '—'}</p>
        </div>

        {/* Col 7: Days in stage */}
        <div className="flex items-start gap-1 py-0.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${colorCls}`}>
            {days}d
          </span>
          {saving && <span className="text-[10px] text-[#999] mt-0.5">…</span>}
        </div>

        {/* Col 8: Last Delivered */}
        <div className="text-xs text-[#666] whitespace-nowrap py-0.5">
          {mc.status_changed_at ? formatRelDate(mc.status_changed_at) : '—'}
        </div>

        {/* Col 9: Unlink */}
        <div className="flex items-start py-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); setUnlinkConfirm(true) }}
            title="Unlink candidate"
            className="w-5 h-5 flex items-center justify-center rounded text-[#CCC] hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
              <path d="M5 5l6 6M11 5L5 11" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {prompt && (
        <StagePromptModal
          type={prompt.type}
          mcId={mc.id}
          supabaseClient={supabase}
          onClose={() => { setPrompt(null); onRefresh() }}
        />
      )}
    </>
  )
}

// ─── Candidate list ────────────────────────────────────────────────────────────

function CandidateList({ displayed, loading, onRefresh, onRowClick, isRecruiter, currentUserId, mandate }) {
  if (loading) {
    return <p className="px-6 py-10 text-sm text-[#999]">Loading candidates…</p>
  }
  if (displayed.length === 0) {
    return <p className="px-6 py-10 text-sm text-[#999]">No candidates match the current filters.</p>
  }

  return (
    <>
      {/* Sticky header */}
      <div className={`${ROW_GRID} ${ROW_COLS} border-b border-[#F0F0F4] bg-[#FAFAFA] sticky top-0 z-10`}>
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Candidate</span>
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Contact</span>
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Stage</span>
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Status</span>
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Details</span>
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider py-0.5 whitespace-nowrap">Recruiter · AM</span>
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider py-0.5 whitespace-nowrap">In Stage</span>
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Delivered</span>
        <span></span>
      </div>

      {displayed.map((mc) => {
        const canEdit = !isRecruiter || mc.linked_by === currentUserId
        return (
          <CandidateTableRow
            key={mc.id}
            mc={mc}
            onRefresh={onRefresh}
            onRowClick={onRowClick}
            canEdit={canEdit}
            mandate={mandate}
          />
        )
      })}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MandatePanel() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { isRecruiter, loading: roleLoading } = useRole()
  const { session }  = useAuth()
  const currentUserId = session?.user?.id

  const [mandate, setMandate]                     = useState(null)
  const [loading, setLoading]                     = useState(true)
  const [fetchError, setFetchError]               = useState('')
  const [mandateCandidates, setMandateCandidates] = useState([])
  const [candidatesLoading, setCandidatesLoading] = useState(true)
  const [amProfiles, setAmProfiles]               = useState([])
  const [recruiterProfiles, setRecruiterProfiles] = useState([])
  const [mandateRecruiters, setMandateRecruiters] = useState([])
  const [selectedRecruiters, setSelectedRecruiters] = useState([])

  const [activeTab, setActiveTab]         = useState('details')
  const [showLinkModal, setShowLinkModal] = useState(false)

  // Candidates tab filter/pagination state
  const [candidateSearch, setCandidateSearch]   = useState('')
  const [stageFilter, setStageFilter]           = useState('')
  const [statusFilter, setStatusFilter]         = useState('')
  const [recruiterFilter, setRecruiterFilter]   = useState('')
  const [candidateSortBy, setCandidateSortBy]   = useState('last_updated')
  const [candidatePage, setCandidatePage]       = useState(1)

  const [isEditing, setIsEditing]     = useState(false)
  const [editFields, setEditFields]   = useState({})
  const [isDirty, setIsDirty]         = useState(false)
  const [editSaving, setEditSaving]   = useState(false)
  const [editError, setEditError]     = useState('')
  const [editSuccess, setEditSuccess] = useState(false)
  const [dialog, setDialog]           = useState(null)
  const [dialogSaving, setDialogSaving] = useState(false)

  const [panelCandidate, setPanelCandidate] = useState(null)

  const originalFieldsRef     = useRef({})
  const originalRecruitersRef = useRef([])

  const linkedIds = useMemo(
    () => new Set(mandateCandidates.map((mc) => mc.candidate_id)),
    [mandateCandidates]
  )

  // Reset candidatePage when any candidate filter/sort changes
  useEffect(() => {
    setCandidatePage(1)
  }, [candidateSearch, stageFilter, statusFilter, recruiterFilter, candidateSortBy])

  // Fetch mandate
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setFetchError('')
    supabase
      .from('mandates')
      .select('*, client:clients!client_id(id, name), am:profiles!am_id(id, name)')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setFetchError(err?.message ?? 'Mandate not found')
        else setMandate(data)
        setLoading(false)
      })
  }, [id])

  // Fetch AM profiles
  useEffect(() => {
    supabase
      .from('profiles').select('id, name, role')
      .in('role', ['account_manager', 'founder']).eq('active', true).order('name')
      .then(({ data }) => setAmProfiles(data ?? []))
  }, [])

  // Fetch recruiter profiles
  useEffect(() => {
    supabase
      .from('profiles').select('id, name')
      .eq('role', 'recruiter').eq('active', true).order('name')
      .then(({ data }) => setRecruiterProfiles(data ?? []))
  }, [])

  // Fetch assigned recruiters
  function fetchMandateRecruiters() {
    if (!id) return
    supabase
      .from('mandate_recruiters')
      .select('recruiter_id, recruiter:profiles!recruiter_id(id, name)')
      .eq('mandate_id', id)
      .then(({ data }) => setMandateRecruiters(data ?? []))
  }
  useEffect(() => { fetchMandateRecruiters() }, [id]) // eslint-disable-line

  // Fetch candidates
  function fetchCandidates() {
    if (!id) return
    setCandidatesLoading(true)
    supabase
      .from('mandate_candidates')
      .select('*, candidate:candidates!candidate_id(id, name, skill_role, email, phone), linked_by_profile:profiles!linked_by(id, name)')
      .eq('mandate_id', id)
      .order('linked_at', { ascending: false })
      .then(({ data }) => {
        setMandateCandidates(data ?? [])
        setCandidatesLoading(false)
      })
  }
  useEffect(() => { fetchCandidates() }, [id]) // eslint-disable-line

  // Derive recruiters actively working this mandate (distinct linked_by)
  const workingRecruiters = useMemo(() => {
    const seen = new Set()
    return mandateCandidates
      .filter((mc) => mc.linked_by && !seen.has(mc.linked_by) && seen.add(mc.linked_by))
      .map((mc) => mc.linked_by_profile ?? { id: mc.linked_by, name: 'Unknown' })
  }, [mandateCandidates])

  // Filtered + sorted candidates
  const filteredCandidates = useMemo(() => {
    let list = isRecruiter
      ? mandateCandidates.filter((mc) => mc.linked_by === currentUserId)
      : [...mandateCandidates]

    const q = candidateSearch.toLowerCase()
    if (q) list = list.filter((mc) =>
      mc.candidate?.name?.toLowerCase().includes(q) ||
      mc.candidate?.email?.toLowerCase().includes(q)
    )
    if (stageFilter)     list = list.filter((mc) => mc.stage === stageFilter)
    if (statusFilter)    list = list.filter((mc) => mc.status === statusFilter)
    if (recruiterFilter) list = list.filter((mc) => mc.linked_by === recruiterFilter)

    if (candidateSortBy === 'stage') {
      list.sort((a, b) => (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99))
    } else if (candidateSortBy === 'last_updated') {
      list.sort((a, b) => {
        const ta = new Date(a.status_changed_at ?? a.linked_at ?? 0).getTime()
        const tb = new Date(b.status_changed_at ?? b.linked_at ?? 0).getTime()
        return tb - ta
      })
    } else if (candidateSortBy === 'days_in_stage') {
      list.sort((a, b) => daysInStage(b) - daysInStage(a))
    }
    return list
  }, [mandateCandidates, candidateSearch, stageFilter, statusFilter, recruiterFilter, candidateSortBy, isRecruiter, currentUserId])

  const paginatedCandidates = useMemo(
    () => filteredCandidates.slice((candidatePage - 1) * 50, candidatePage * 50),
    [filteredCandidates, candidatePage]
  )

  // Fetch full candidate on row click → open CandidatePanel
  async function handleRowClick(candidateId) {
    const { data } = await supabase
      .from('candidates')
      .select('*, profiles(id, name), clients(id, name)')
      .eq('id', candidateId)
      .single()
    setPanelCandidate(data ?? null)
  }

  // Dirty tracking
  useEffect(() => {
    if (!isEditing) return
    const orig = originalFieldsRef.current
    const fieldsDirty = EDITABLE_FIELDS.some((k) => String(editFields[k] ?? '') !== String(orig[k] ?? ''))
    const origSet = new Set(originalRecruitersRef.current)
    const curSet  = new Set(selectedRecruiters)
    const recruitersDirty = origSet.size !== curSet.size || [...origSet].some((rid) => !curSet.has(rid))
    setIsDirty(fieldsDirty || recruitersDirty)
  }, [editFields, selectedRecruiters, isEditing])

  useEffect(() => {
    window.onbeforeunload = isDirty ? () => true : null
    return () => { window.onbeforeunload = null }
  }, [isDirty])

  // Edit helpers
  function handleEditStart() {
    const fields = initEditFields(mandate)
    originalFieldsRef.current = { ...fields }
    setEditFields(fields)
    const currentIds = mandateRecruiters.map((r) => r.recruiter_id)
    originalRecruitersRef.current = currentIds
    setSelectedRecruiters(currentIds)
    setEditError('')
    setEditSuccess(false)
    setIsDirty(false)
    setIsEditing(true)
    setActiveTab('details')
  }

  function toggleRecruiter(rid) {
    setSelectedRecruiters((prev) => prev.includes(rid) ? prev.filter((r) => r !== rid) : [...prev, rid])
  }

  function setEditField(key, value) {
    setEditFields((prev) => ({ ...prev, [key]: value }))
  }

  function resetEditState() {
    setIsEditing(false)
    setEditError('')
    setIsDirty(false)
  }

  function handleEditCancel() {
    if (isDirty) {
      setDialog({
        message: 'Save changes before cancelling?',
        onSave: async () => { setDialogSaving(true); await performSave(); setDialogSaving(false); setDialog(null) },
        onDiscard: () => { resetEditState(); setDialog(null) },
        onCancel: () => setDialog(null),
      })
    } else {
      resetEditState()
    }
  }

  async function performSave() {
    setEditSaving(true)
    setEditError('')

    const payload = {
      title:           editFields.title?.trim() || null,
      status:          editFields.status || null,
      priority:        editFields.priority || null,
      num_positions:   editFields.num_positions !== '' ? Number(editFields.num_positions) : null,
      experience_min:  editFields.experience_min !== '' ? Number(editFields.experience_min) : null,
      experience_max:  editFields.experience_max !== '' ? Number(editFields.experience_max) : null,
      location:        editFields.location?.trim() || null,
      work_mode:       editFields.work_mode || null,
      employment_type: editFields.employment_type || null,
      budget_min:      editFields.budget_min !== '' ? Number(editFields.budget_min) : null,
      budget_max:      editFields.budget_max !== '' ? Number(editFields.budget_max) : null,
      budget_currency: editFields.budget_currency?.trim() || 'INR',
      internal_notes:  editFields.internal_notes?.trim() || null,
      jd_text:         editFields.jd_text?.trim() || null,
      am_id:           editFields.am_id || null,
      updated_at:      new Date().toISOString(),
    }

    const { data, error: err } = await supabase
      .from('mandates')
      .update(payload)
      .eq('id', id)
      .select('*, client:clients!client_id(id, name), am:profiles!am_id(id, name)')
      .single()

    setEditSaving(false)
    if (err) { setEditError(err.message); return false }

    setMandate(data)

    const origSet  = new Set(originalRecruitersRef.current)
    const newSet   = new Set(selectedRecruiters)
    const toAdd    = [...newSet].filter((rid) => !origSet.has(rid))
    const toRemove = [...origSet].filter((rid) => !newSet.has(rid))

    if (toAdd.length > 0) {
      const { error: addErr } = await supabase.from('mandate_recruiters').insert(toAdd.map((rid) => ({ mandate_id: id, recruiter_id: rid })))
      if (addErr) { setEditError(addErr.message); return false }
    }
    if (toRemove.length > 0) {
      const { error: rmErr } = await supabase.from('mandate_recruiters').delete().eq('mandate_id', id).in('recruiter_id', toRemove)
      if (rmErr) { setEditError(rmErr.message); return false }
    }

    originalRecruitersRef.current = [...newSet]
    fetchMandateRecruiters()

    setIsEditing(false)
    setIsDirty(false)
    setEditSuccess(true)
    setTimeout(() => setEditSuccess(false), 3000)
    return true
  }

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell title="Mandate">
        <div className="flex items-center justify-center h-64 text-sm text-[#999]">Loading…</div>
      </AppShell>
    )
  }

  if (fetchError || !mandate) {
    return (
      <AppShell title="Mandate">
        <div className="px-6 py-6">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {fetchError || 'Mandate not found.'}
          </div>
        </div>
      </AppShell>
    )
  }

  const candidateStatusOptions = stageFilter ? (STAGE_STATUS_MAP[stageFilter] ?? []) : ALL_MC_STATUSES
  const hasCandidateFilters = !!(candidateSearch || stageFilter || statusFilter || recruiterFilter)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppShell title={mandate.title}>
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#F0F0F4] px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/mandates')}
            className="flex items-center gap-1 text-sm text-[#666] hover:text-[#0F0F12] transition-colors shrink-0"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <span className="text-[#E0E0E8] select-none">|</span>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-semibold text-[#0F0F12] truncate">{mandate.title}</h1>
            <MandateStatusBadge value={mandate.status} />
            <PriorityBadge value={mandate.priority} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editSuccess && <span className="text-xs text-green-600 font-medium">Saved</span>}
          {!isRecruiter && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 flex items-center gap-1.5"
              style={{ backgroundColor: '#5E6AD2' }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              Link Candidate
            </button>
          )}
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

      {/* Snapshot strip */}
      <SnapshotStrip mandateCandidates={mandateCandidates} mandate={mandate} />

      {/* Tab bar */}
      <div className="flex border-b border-[#F0F0F4] px-6">
        <button
          onClick={() => setActiveTab('details')}
          className={`py-2.5 mr-5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'details'
              ? 'border-[#5E6AD2] text-[#5E6AD2]'
              : 'border-transparent text-[#999] hover:text-[#666]'
          }`}
        >
          Details
        </button>
        <button
          onClick={() => !isEditing && setActiveTab('candidates')}
          disabled={isEditing}
          className={`py-2.5 mr-5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'candidates'
              ? 'border-[#5E6AD2] text-[#5E6AD2]'
              : isEditing
              ? 'border-transparent text-[#CCC] cursor-not-allowed'
              : 'border-transparent text-[#999] hover:text-[#666]'
          }`}
        >
          Candidates
        </button>
      </div>

      {/* Details tab */}
      {activeTab === 'details' && (
        <div className="px-6 pt-5 pb-8">
          {isEditing ? (
            <EditView
              editFields={editFields}
              setEditField={setEditField}
              amProfiles={amProfiles}
              recruiterProfiles={recruiterProfiles}
              selectedRecruiters={selectedRecruiters}
              toggleRecruiter={toggleRecruiter}
            />
          ) : (
            <ReadDetails mandate={mandate} workingRecruiters={workingRecruiters} />
          )}
        </div>
      )}

      {/* Candidates tab */}
      {activeTab === 'candidates' && (
        <div className="flex-1 overflow-auto flex flex-col min-h-0">
          {/* Filter bar */}
          <div className="px-5 py-3 border-b border-[#F0F0F4] bg-white flex items-center gap-3 flex-wrap shrink-0">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5l3 3" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search name or email…"
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-48"
              />
            </div>

            {/* Stage */}
            <select
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setStatusFilter('') }}
              className={selCls}
            >
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Status */}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selCls}>
              <option value="">All statuses</option>
              {candidateStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Recruiter — non-recruiters only */}
            {!isRecruiter && workingRecruiters.length > 0 && (
              <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className={selCls}>
                <option value="">All recruiters</option>
                {workingRecruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}

            {/* Sort */}
            <select value={candidateSortBy} onChange={(e) => setCandidateSortBy(e.target.value)} className={selCls}>
              <option value="last_updated">Sort: Last updated</option>
              <option value="stage">Sort: Stage</option>
              <option value="days_in_stage">Sort: Days in stage ↓</option>
            </select>

            {/* Clear */}
            {hasCandidateFilters && (
              <button
                onClick={() => { setCandidateSearch(''); setStageFilter(''); setStatusFilter(''); setRecruiterFilter('') }}
                className="text-xs text-[#5E6AD2] hover:underline ml-1"
              >
                Clear filters
              </button>
            )}

            {/* Count */}
            <span className="text-xs text-[#999] ml-auto">
              {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? 's' : ''}
            </span>
          </div>

          <CandidateList
            displayed={paginatedCandidates}
            loading={candidatesLoading}
            onRefresh={fetchCandidates}
            onRowClick={handleRowClick}
            isRecruiter={isRecruiter}
            currentUserId={currentUserId}
            mandate={mandate}
          />

          {!candidatesLoading && filteredCandidates.length > 0 && (
            <Pagination
              total={filteredCandidates.length}
              page={candidatePage}
              onChange={setCandidatePage}
            />
          )}
        </div>
      )}

      {/* Modals */}
      {showLinkModal && (
        <LinkCandidateModal
          mandateId={id}
          linkedIds={linkedIds}
          onLink={() => { setShowLinkModal(false); fetchCandidates() }}
          onClose={() => setShowLinkModal(false)}
        />
      )}

      <CandidatePanel
        candidate={panelCandidate}
        onClose={() => setPanelCandidate(null)}
        onUpdate={() => {}}
      />

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
