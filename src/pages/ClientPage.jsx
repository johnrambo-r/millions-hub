import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { supabase } from '../lib/supabase'
import { AccountStatusBadge, ClientTypeBadge } from './Clients'
import { StageBadge, StatusBadge as CandidateStatusBadge } from '../components/pipeline/StageBadge'
import UnsavedChangesModal from '../components/UnsavedChangesModal'
import useRole from '../hooks/useRole'
import { useAuth } from '../context/AuthContext'
import { STAGES, STAGE_STATUS_MAP, ACTIVE_STATUSES, PLACED_STATUSES } from '../lib/candidateConstants'
import { InlineDropdown, StagePromptModal } from '../components/pipeline/InlineStageStatus'
import { logActivity } from '../lib/activityLog'
import CandidatePanel from '../components/pipeline/CandidatePanel'

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

const PIPELINE_STAGES     = new Set(['L2', 'L3', 'Client Onsite', 'HR'])
const INTERVIEW_OR_BEYOND = new Set(['L1', 'L2', 'L3', 'Client Onsite', 'HR', 'Offer', 'Joining'])
const INTERVIEW_STAGES    = new Set(['L1', 'L2', 'L3', 'Client Onsite', 'HR'])
const ACTIVE_STATUS_SET   = new Set(ACTIVE_STATUSES)
const PLACED_STATUS_SET   = new Set(PLACED_STATUSES)
const STAGE_ORDER         = Object.fromEntries(STAGES.map((s, i) => [s, i]))

const ACCOUNT_STATUSES = ['Active', 'On Hold', 'Inactive']
const CLIENT_TYPES     = ['GCC', 'Product Startup', 'IT Services', 'Consulting']

const EDITABLE_FIELDS = [
  'name', 'industry', 'client_type', 'location', 'website', 'about',
  'primary_contact_name', 'primary_contact_designation',
  'primary_contact_email', 'primary_contact_phone',
  'account_status', 'notes', 'account_manager_id',
]

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

const ROW_GRID = 'grid gap-x-2 px-3 py-2.5'
const ROW_COLS = 'grid-cols-[minmax(100px,2fr)_auto_auto_minmax(56px,1fr)_auto_52px_22px]'

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

function ClientSummaryStrip({ clientId, refreshKey }) {
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
  }, [clientId, refreshKey])

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

// ─── Candidate Table Row ──────────────────────────────────────────────────────

function CandidateTableRow({ mc, onRefresh, onRowClick, canEdit }) {
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
  const lastUpdated   = mc.status_changed_at ?? mc.linked_at

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
    else if (newStage === 'Offer')       setPrompt({ type: 'offer' })
    else if (newStage === 'Joining')     setPrompt({ type: 'joining' })
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
        <div className="col-span-7 flex items-center gap-3">
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
        <div className="min-w-0 py-0.5">
          <p className="text-sm font-medium text-[#0F0F12] truncate">{mc.candidate?.name ?? '—'}</p>
          <p className="text-xs text-[#999] mt-0.5 font-mono">{mc.applicant_id ?? '—'}</p>
        </div>

        <div className="py-0.5">
          <InlineDropdown
            badge={<StageBadge value={stage || null} />}
            options={STAGES}
            onSelect={handleStageChange}
            disabled={!canEdit}
          />
        </div>

        <div className="py-0.5">
          <InlineDropdown
            badge={<CandidateStatusBadge value={status || null} />}
            options={statusOptions}
            onSelect={handleStatusChange}
            disabled={!canEdit || !stage}
          />
        </div>

        <div className="min-w-0 space-y-0.5 py-0.5">
          {interviewStr && (
            <p className="text-xs text-[#555] truncate">
              <span className="text-[#999] mr-1">Int</span>{interviewStr}
            </p>
          )}
          {ctcStr && (
            <p className="text-xs text-[#555]">
              <span className="text-[#999] mr-1">CTC</span>{ctcStr}
            </p>
          )}
          {billingStr && (
            <p className="text-xs text-[#555]">
              <span className="text-[#999] mr-1">Bill</span>{billingStr}
            </p>
          )}
          {dojStr && (
            <p className="text-xs text-[#555]">
              <span className="text-[#999] mr-1">DOJ</span>{dojStr}
            </p>
          )}
          {!hasDetails && <span className="text-xs text-[#DDD]">—</span>}
        </div>

        <div className="flex items-start gap-1 py-0.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${colorCls}`}>
            {days}d
          </span>
          {saving && <span className="text-[10px] text-[#999] mt-0.5">…</span>}
        </div>

        <div className="text-xs text-[#999] whitespace-nowrap py-0.5">{formatRelDate(lastUpdated)}</div>

        <div className="flex justify-end py-0.5">
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

// ─── Candidate Table ──────────────────────────────────────────────────────────

function CandidateTable({ mandateId, mcs, loading, onRefresh, onRowClick, isRecruiter, currentUserId }) {
  const [filterStage, setFilterStage] = useState('')
  const [sortBy, setSortBy]           = useState('last_updated')
  const [showModal, setShowModal]     = useState(false)

  const linkedIds = useMemo(() => new Set(mcs.map((mc) => mc.candidate_id)), [mcs])

  const displayed = useMemo(() => {
    let list = isRecruiter
      ? mcs.filter((mc) => mc.linked_by === currentUserId)
      : [...mcs]

    if (filterStage) list = list.filter((mc) => mc.stage === filterStage)

    if (sortBy === 'stage') {
      list.sort((a, b) => (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99))
    } else if (sortBy === 'last_updated') {
      list.sort((a, b) => {
        const ta = new Date(a.status_changed_at ?? a.linked_at ?? 0).getTime()
        const tb = new Date(b.status_changed_at ?? b.linked_at ?? 0).getTime()
        return tb - ta
      })
    } else if (sortBy === 'days_in_stage') {
      list.sort((a, b) => daysInStage(b) - daysInStage(a))
    }
    return list
  }, [mcs, filterStage, sortBy, isRecruiter, currentUserId])

  return (
    <div>
      <div className="px-3 py-2 border-t border-[#F0F0F4] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="h-7 rounded-lg border border-[#F0F0F4] bg-white px-2 text-xs text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition"
          >
            <option value="">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-7 rounded-lg border border-[#F0F0F4] bg-white px-2 text-xs text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition"
          >
            <option value="last_updated">Last updated</option>
            <option value="stage">Stage</option>
            <option value="days_in_stage">Days ↓</option>
          </select>
          <span className="text-xs text-[#999]">
            {displayed.length}{filterStage ? ` of ${mcs.length}` : ''} candidate{displayed.length !== 1 ? 's' : ''}
          </span>
        </div>
        {!isRecruiter && (
          <button
            onClick={() => setShowModal(true)}
            className="h-7 px-2.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 flex items-center gap-1 shrink-0"
            style={{ backgroundColor: '#5E6AD2' }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            Link Candidate
          </button>
        )}
      </div>

      {loading ? (
        <p className="px-3 py-8 text-sm text-[#999]">Loading candidates…</p>
      ) : displayed.length === 0 ? (
        <p className="px-3 py-8 text-sm text-[#999]">
          {filterStage ? 'No candidates at this stage.' : 'No candidates linked yet.'}
        </p>
      ) : (
        <>
          <div className={`${ROW_GRID} ${ROW_COLS} border-t border-[#F0F0F4] bg-[#FAFAFA]`}>
            <span className="text-[9px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Candidate</span>
            <span className="text-[9px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Stage</span>
            <span className="text-[9px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Status</span>
            <span className="text-[9px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Details</span>
            <span className="text-[9px] font-semibold text-[#999] uppercase tracking-wider py-0.5">In Stage</span>
            <span className="text-[9px] font-semibold text-[#999] uppercase tracking-wider py-0.5">Updated</span>
            <span />
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
              />
            )
          })}
        </>
      )}

      {showModal && (
        <LinkCandidateModal
          mandateId={mandateId}
          linkedIds={linkedIds}
          onLink={() => { setShowModal(false); onRefresh() }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ─── Mandate Snapshot Strip ───────────────────────────────────────────────────

function MandateSnapshotStrip({ mcs, mandate }) {
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
            className={`flex flex-col items-center justify-center px-4 py-2.5 shrink-0 ${i > 0 ? 'border-l border-[#EAEAF0]' : ''}`}
          >
            <span className={`text-2xl font-bold leading-tight tabular-nums ${t.accent}`}>{t.value}</span>
            <span className="text-[9px] font-medium text-[#999] uppercase tracking-wider mt-0.5 whitespace-nowrap">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mandate Read Details ─────────────────────────────────────────────────────

function MandateReadDetails({ mandate, recruiters }) {
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
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      <Field label="Role / Job ID" colSpan2>
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
      <Field label="Recruiters Working" colSpan2>
        {recruiters.length === 0 ? '—' : (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {recruiters.map((r) => (
              <span key={r.recruiter_id} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700">
                {r.recruiter?.name ?? r.recruiter_id}
              </span>
            ))}
          </div>
        )}
      </Field>
    </dl>
  )
}

// ─── Mandate Expanded Content ─────────────────────────────────────────────────

function MandateExpandedContent({ mandate, onCandidateClick, onSummaryRefresh, isRecruiter, currentUserId }) {
  const [mcs, setMcs]               = useState([])
  const [recruiters, setRecruiters] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => { loadData() }, [mandate.id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const [{ data: mcsData }, { data: recData }] = await Promise.all([
      supabase
        .from('mandate_candidates')
        .select(`
          id, stage, status, status_changed_at, linked_at,
          offered_ctc, billing_value_approx, billing_value_final,
          date_of_joining, applicant_id, interview_date, interview_time,
          candidate_id, mandate_id, linked_by,
          candidate:candidates!candidate_id(id, name, skill_role, email, phone)
        `)
        .eq('mandate_id', mandate.id)
        .order('linked_at', { ascending: false }),
      supabase
        .from('mandate_recruiters')
        .select('recruiter_id, recruiter:profiles!recruiter_id(id, name)')
        .eq('mandate_id', mandate.id),
    ])
    setMcs(mcsData ?? [])
    setRecruiters(recData ?? [])
    setLoading(false)
  }

  function handleRefresh() {
    loadData()
    onSummaryRefresh()
  }

  return (
    <div className="border-t border-[#F0F0F4]">
      <MandateSnapshotStrip mcs={mcs} mandate={mandate} />
      <div className="px-4 py-4 border-b border-[#F0F0F4] bg-white">
        <MandateReadDetails mandate={mandate} recruiters={recruiters} />
      </div>
      <div className="bg-[#FAFAFA]">
        <CandidateTable
          mandateId={mandate.id}
          mcs={mcs}
          loading={loading}
          onRefresh={handleRefresh}
          onRowClick={onCandidateClick}
          isRecruiter={isRecruiter}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  )
}

// ─── Mandate Card ─────────────────────────────────────────────────────────────

function MandateCard({ mandate, isExpanded, onToggle, onCandidateClick, onSummaryRefresh, isRecruiter, currentUserId }) {
  const daysOpen = mandate.created_at
    ? Math.floor((Date.now() - new Date(mandate.created_at)) / 86400000)
    : null

  return (
    <div className="rounded-lg border border-[#F0F0F4] bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[#0F0F12] truncate">{mandate.title}</p>
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
          className={`w-4 h-4 text-[#999] transition-transform shrink-0 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isExpanded && (
        <MandateExpandedContent
          mandate={mandate}
          onCandidateClick={onCandidateClick}
          onSummaryRefresh={onSummaryRefresh}
          isRecruiter={isRecruiter}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}

// ─── Mandates Tab ─────────────────────────────────────────────────────────────

function MandatesTab({ clientId, onCandidateClick, onSummaryRefresh, isRecruiter, currentUserId }) {
  const [mandates, setMandates]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [subTab, setSubTab]         = useState('active')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    supabase
      .from('mandates')
      .select(`
        id, title, job_id, status, priority, location, num_positions, created_at,
        experience_min, experience_max, budget_min, budget_max, budget_currency,
        work_mode, employment_type, am_id,
        am:profiles!am_id(id, name)
      `)
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

  function handleToggle(id) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4">
        {[
          { key: 'active',   label: 'Active',   count: activeMandates.length },
          { key: 'inactive', label: 'Inactive', count: inactiveMandates.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => { setSubTab(key); setExpandedId(null) }}
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
            <MandateCard
              key={m.id}
              mandate={m}
              isExpanded={expandedId === m.id}
              onToggle={() => handleToggle(m.id)}
              onCandidateClick={onCandidateClick}
              onSummaryRefresh={onSummaryRefresh}
              isRecruiter={isRecruiter}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientPage() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { isRecruiter } = useRole()
  const { session }  = useAuth()
  const currentUserId = session?.user?.id

  const [client, setClient]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [activeTab, setActiveTab]               = useState('details')
  const [amProfiles, setAmProfiles]             = useState([])
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0)
  const [panelCandidate, setPanelCandidate]     = useState(null)

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

  async function handleCandidateClick(candidateId) {
    const { data } = await supabase
      .from('candidates')
      .select('*, profiles(id, name), clients(id, name)')
      .eq('id', candidateId)
      .single()
    setPanelCandidate(data ?? null)
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
      <ClientSummaryStrip clientId={id} refreshKey={summaryRefreshKey} />

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
          <MandatesTab
            clientId={id}
            onCandidateClick={handleCandidateClick}
            onSummaryRefresh={() => setSummaryRefreshKey((k) => k + 1)}
            isRecruiter={isRecruiter}
            currentUserId={currentUserId}
          />
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

      <CandidatePanel
        candidate={panelCandidate}
        onClose={() => setPanelCandidate(null)}
        onUpdate={() => {}}
      />
    </AppShell>
  )
}
