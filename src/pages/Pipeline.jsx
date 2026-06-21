import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Pagination from '../components/Pagination'
import AppShell from '../components/layout/AppShell'
import { StageBadge, StatusBadge } from '../components/pipeline/StageBadge'
import { InlineDropdown, StagePromptModal } from '../components/pipeline/InlineStageStatus'
import CandidatePanel from '../components/pipeline/CandidatePanel'
import AssignMandateModal from '../components/AssignMandateModal'
import SuccessToast from '../components/add-candidate/SuccessToast'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import {
  STAGES,
  STAGE_STATUS_MAP,
  ACTIVE_STATUSES,
  TALENT_POOL_STATUSES,
  PLACED_STATUSES,
  getNextStageOptions,
} from '../lib/candidateConstants'
import useRole from '../hooks/useRole'

// ─── constants ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'pipeline',    label: 'Pipeline' },
  { id: 'active',      label: 'Active' },
  { id: 'talent_pool', label: 'Talent Pool' },
  { id: 'placed',      label: 'Placed' },
  { id: 'unassigned',  label: 'Unassigned' },
  { id: 'all',         label: 'All' },
]

const CANDIDATE_FIELDS = `
  id, name, email, phone, alt_contact,
  current_location, preferred_location, willing_to_relocate,
  education, year_of_passing,
  current_company, skill_role, total_exp, relevant_exp,
  emp_mode, payroll_company, notice_period,
  current_ctc, expected_ctc, ctc_breakup,
  source, linkedin_url, languages_known, reason_for_looking,
  comments, resume_url,
  offers_in_hand, lwd, dob, notable_ids,
  recruiter_id, created_at, status_changed_at, last_updated_at,
  profiles(id, name),
  clients(id, name)
`

const MC_SELECT = `
  id, candidate_id, stage, status, applicant_id, status_changed_at, linked_by, linked_at,
  interview_date, interview_time, date_of_joining, assessment_date, mandate_id,
  billing_value_approx,
  linked_by_profile:profiles!linked_by(id, name),
  candidates(${CANDIDATE_FIELDS}),
  mandates(id, title, job_id, clients(id, name), am:profiles!am_id(id, name))
`

const UNASSIGNED_SELECT = CANDIDATE_FIELDS

const ALL_SELECT = `
  ${CANDIDATE_FIELDS},
  mandate_candidates(id, candidate_id, mandate_id, applicant_id, stage, status, status_changed_at, billing_value_approx)
`

const MC_TABS = new Set(['pipeline', 'active', 'talent_pool', 'placed'])

// Tabs that use the new 9-column table layout
const NEW_LAYOUT_TABS = new Set(['pipeline', 'active'])

// Stages from L2 upward — used for pipeline tab DB-level filter
const L2_ABOVE_STAGES = STAGES.slice(STAGES.indexOf('L2'))

// All statuses flattened — used in status dropdown when no stage is selected
const ALL_STATUSES_FLAT = [...new Set(Object.values(STAGE_STATUS_MAP).flat())].sort()

const INTERVIEW_STAGES = new Set(['L1', 'L2', 'L3', 'Client Onsite', 'HR'])

// ─── helpers ────────────────────────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function formatRelativeDate(str) {
  if (!str) return '—'
  const days = daysSince(str)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function unassignedRowBg(createdAt) {
  const d = daysSince(createdAt)
  if (d >= 14) return 'bg-red-50'
  if (d >= 7)  return 'bg-amber-50'
  return ''
}

function noShowRowBg(row) {
  if (row.status !== 'No Show') return ''
  const d = daysSince(row.status_changed_at)
  if (d >= 30) return 'bg-red-50'
  if (d >= 15) return 'bg-amber-50'
  return ''
}

function latestMC(row) {
  const mcs = row.mandate_candidates
  if (!mcs?.length) return null
  return mcs.reduce((best, mc) =>
    !best || new Date(mc.status_changed_at) > new Date(best.status_changed_at) ? mc : best
  , null)
}

// ─── small UI components ────────────────────────────────────────────────────

const TH = ({ children, className = '' }) => (
  <th className={`px-4 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap ${className}`}>
    {children}
  </th>
)

const TD = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
)

function SelectFilter({ value, onChange, placeholder, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition min-w-[130px]"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

function EmptyState({ message = 'No candidates match the current filters' }) {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-[#999]">{message}</div>
  )
}

function LoadingState() {
  return <div className="flex items-center justify-center py-20 text-sm text-[#999]">Loading…</div>
}

// ─── In Stage badge ──────────────────────────────────────────────────────────

function InStageBadge({ dateStr }) {
  if (!dateStr) return <span className="text-xs text-[#999]">—</span>
  const days = daysSince(dateStr)
  if (days < 7) {
    return <span className="text-xs text-[#666]">{days}d</span>
  }
  if (days < 14) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700">
        {days}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700">
      {days}d
    </span>
  )
}

// ─── New Pipeline / Active table ─────────────────────────────────────────────

function NewMCRow({ row, onSelect, onRefresh }) {
  const { session } = useAuth()
  const [stage, setStage]   = useState(row.stage ?? '')
  const [status, setStatus] = useState(row.status ?? '')
  const [prompt, setPrompt] = useState(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState(row.interview_date ?? '')
  const [rescheduleTime, setRescheduleTime] = useState(row.interview_time ?? '')
  const rescheduleRef = useRef(null)

  useEffect(() => {
    if (!rescheduling) return
    function handler(e) {
      if (rescheduleRef.current && !rescheduleRef.current.contains(e.target)) setRescheduling(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [rescheduling])

  const c         = row.candidates ?? {}
  const changedBy = session?.user?.id
  const rowBg     = noShowRowBg({ status, status_changed_at: row.status_changed_at })

  async function handleStageChange(newStage) {
    const oldStage  = stage
    const oldStatus = status
    const newStatus = STAGE_STATUS_MAP[newStage]?.[0] ?? null

    setStage(newStage)
    setStatus(newStatus ?? '')

    await supabase.from('mandate_candidates')
      .update({ stage: newStage, status: newStatus, status_changed_at: new Date().toISOString() })
      .eq('id', row.id)

    await logActivity({ candidateId: row.candidate_id, mandateId: row.mandate_id, applicantId: row.applicant_id, changedBy, changeType: 'stage', oldValue: oldStage, newValue: newStage })
    if (oldStatus !== newStatus) {
      await logActivity({ candidateId: row.candidate_id, mandateId: row.mandate_id, applicantId: row.applicant_id, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
    }

    if (newStage === 'Pre-L1 Assessment' || newStage === 'Post-L1 Assessment') {
      setPrompt({ type: 'assessment' })
    } else if (INTERVIEW_STAGES.has(newStage)) {
      setPrompt({ type: 'interview' })
    } else if (newStage === 'Offer') {
      setPrompt({ type: 'offer' })
    } else if (newStage === 'Joining') {
      setPrompt({ type: 'joining' })
    } else {
      onRefresh()
    }
  }

  async function handleStatusChange(newStatus) {
    const oldStatus = status
    setStatus(newStatus)

    const updates = { status: newStatus, status_changed_at: new Date().toISOString() }
    if (newStatus === 'Invoice Raised' && row.billing_value_approx != null) {
      updates.billing_value_final = row.billing_value_approx
    }

    await supabase.from('mandate_candidates').update(updates).eq('id', row.id)
    await logActivity({ candidateId: row.candidate_id, mandateId: row.mandate_id, applicantId: row.applicant_id, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
    onRefresh()
  }

  const statusOptions = stage ? (STAGE_STATUS_MAP[stage] ?? []) : []

  let interviewDojContent
  if (INTERVIEW_STAGES.has(stage)) {
    if (row.interview_date) {
      const d = new Date(row.interview_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      interviewDojContent = (
        <div>
          <div className="flex items-center">
            <span className="text-sm text-[#0F0F12]">{d}</span>
            <span className="relative shrink-0" ref={rescheduleRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setRescheduling(true) }}
                className="ml-1 text-[#999] hover:text-[#5E6AD2] transition-colors"
                title="Reschedule"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 inline">
                  <path d="M11.5 2.5l2 2L5 13l-3 1 1-3 8.5-8.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {rescheduling && (
                <div className="absolute top-full left-0 bg-white border border-[#E0E0E8] rounded-lg shadow-lg p-3 z-50 min-w-[200px]">
                  <label className="block mb-2">
                    <span className="text-xs text-[#999] mb-1 block">Date</span>
                    <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="h-8 w-full rounded-lg border border-[#F0F0F4] px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition" />
                  </label>
                  <label className="block mb-3">
                    <span className="text-xs text-[#999] mb-1 block">Time</span>
                    <input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="h-8 w-full rounded-lg border border-[#F0F0F4] px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition" />
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const oldVal = [row.interview_date, row.interview_time].filter(Boolean).join(' ')
                        const newVal = [rescheduleDate, rescheduleTime].filter(Boolean).join(' ')
                        await supabase.from('mandate_candidates').update({ interview_date: rescheduleDate || null, interview_time: rescheduleTime || null }).eq('id', row.id)
                        await logActivity({ candidateId: row.candidate_id, mandateId: row.mandate_id, applicantId: row.applicant_id, changedBy, changeType: 'interview_reschedule', oldValue: oldVal, newValue: newVal })
                        setRescheduling(false)
                        onRefresh()
                      }}
                      className="h-7 px-3 rounded-lg text-xs font-semibold text-white bg-[#5E6AD2] hover:opacity-90 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRescheduling(false) }}
                      className="h-7 px-3 rounded-lg text-xs text-[#666] border border-[#F0F0F4] hover:bg-[#F5F5F8] transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </span>
          </div>
          {row.interview_time && (
            <span className="block text-xs text-[#999]">{row.interview_time}</span>
          )}
        </div>
      )
    } else {
      interviewDojContent = <span className="text-[#999]">—</span>
    }
  } else if (stage === 'Offer' || stage === 'Joining') {
    if (row.date_of_joining) {
      const d = new Date(row.date_of_joining).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
      interviewDojContent = <span className="text-sm text-[#0F0F12]">{d}</span>
    } else {
      interviewDojContent = <span className="text-[#999]">—</span>
    }
  } else {
    interviewDojContent = <span className="text-[#999]">—</span>
  }

  return (
    <>
      <tr
        className={`border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors ${rowBg}`}
      >
        <TD>
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(c) }}
            className="font-medium text-[#0F0F12] block truncate max-w-[150px] cursor-pointer hover:text-[#5E6AD2] hover:underline"
          >{c.name ?? '—'}</span>
          <span className="text-xs text-[#999] font-mono block mt-0.5">{row.applicant_id ?? '—'}</span>
        </TD>
        <TD>
          <span className="text-xs text-[#666] block">{c.phone ?? '—'}</span>
          <span className="text-xs text-[#999] block mt-0.5 truncate max-w-[160px]">{c.email ?? '—'}</span>
        </TD>
        <TD>
          <p className="text-xs font-semibold text-[#0F0F12] truncate max-w-[180px]">
            {row.mandates?.clients?.name ?? '—'}
          </p>
          <p className="text-xs text-[#999] truncate max-w-[180px] mt-0.5">
            {row.mandates?.title ?? '—'}{row.mandates?.job_id ? ` · ${row.mandates.job_id}` : ''}
          </p>
        </TD>
        <TD onClick={(e) => e.stopPropagation()}>
          <InlineDropdown
            badge={<StageBadge value={stage || null} />}
            options={getNextStageOptions(stage)}
            onSelect={handleStageChange}
          />
        </TD>
        <TD onClick={(e) => e.stopPropagation()}>
          <InlineDropdown
            badge={<StatusBadge value={status || null} />}
            options={statusOptions}
            onSelect={handleStatusChange}
            disabled={!stage}
          />
        </TD>
        <TD>{interviewDojContent}</TD>
        <TD>
          <span className="font-medium text-[#0F0F12] block text-sm truncate max-w-[130px]">
            {row.linked_by_profile?.name ?? '—'}
          </span>
          <span className="text-xs text-[#999] block mt-0.5 truncate max-w-[130px]">
            {row.mandates?.am?.name ?? '—'}
          </span>
        </TD>
        <TD>
          <InStageBadge dateStr={row.status_changed_at} />
        </TD>
        <TD className="text-xs text-[#999]">
          {formatRelativeDate(row.status_changed_at)}
        </TD>
      </tr>
      {prompt && (
        <StagePromptModal
          type={prompt.type}
          mcId={row.id}
          supabaseClient={supabase}
          existingData={row}
          onClose={() => { setPrompt(null); onRefresh() }}
        />
      )}
    </>
  )
}

function NewMCTable({ rows, loading, onSelect, onRefresh }) {
  if (loading) return <LoadingState />
  if (rows.length === 0) return <EmptyState />

  return (
    <table className="w-full min-w-[1100px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#FAFAFA]">
          <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
            <TH>Candidate</TH>
            <TH>Contact</TH>
            <TH>Client · Mandate</TH>
            <TH className="w-28">Stage</TH>
            <TH className="w-36">Status</TH>
            <TH className="w-32">Interview / DOJ</TH>
            <TH>Recruiter · AM</TH>
            <TH className="w-24">In Stage</TH>
            <TH className="w-24">Updated</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <NewMCRow
              key={row.id}
              row={row}
              onSelect={onSelect}
              onRefresh={onRefresh}
            />
          ))}
        </tbody>
    </table>
  )
}

// ─── MC table (Talent Pool / Placed) ─────────────────────────────────────────

function MCRow({ row, onSelect, activeTab, onRefresh, onReassign }) {
  const { session } = useAuth()
  const [stage, setStage]   = useState(row.stage ?? '')
  const [status, setStatus] = useState(row.status ?? '')
  const [prompt, setPrompt] = useState(null)

  const c            = row.candidates ?? {}
  const isTalentPool = activeTab === 'talent_pool'
  const changedBy    = session?.user?.id

  async function handleStageChange(newStage) {
    const oldStage  = stage
    const oldStatus = status
    const newStatus = STAGE_STATUS_MAP[newStage]?.[0] ?? null

    setStage(newStage)
    setStatus(newStatus ?? '')

    await supabase.from('mandate_candidates')
      .update({ stage: newStage, status: newStatus, status_changed_at: new Date().toISOString() })
      .eq('id', row.id)

    await logActivity({ candidateId: row.candidate_id, mandateId: row.mandate_id, applicantId: row.applicant_id, changedBy, changeType: 'stage', oldValue: oldStage, newValue: newStage })
    if (oldStatus !== newStatus) {
      await logActivity({ candidateId: row.candidate_id, mandateId: row.mandate_id, applicantId: row.applicant_id, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
    }

    if (newStage === 'Pre-L1 Assessment' || newStage === 'Post-L1 Assessment') {
      setPrompt({ type: 'assessment' })
    } else if (INTERVIEW_STAGES.has(newStage)) {
      setPrompt({ type: 'interview' })
    } else if (newStage === 'Offer') {
      setPrompt({ type: 'offer' })
    } else if (newStage === 'Joining') {
      setPrompt({ type: 'joining' })
    } else {
      onRefresh()
    }
  }

  async function handleStatusChange(newStatus) {
    const oldStatus = status
    setStatus(newStatus)

    const updates = { status: newStatus, status_changed_at: new Date().toISOString() }
    if (newStatus === 'Invoice Raised' && row.billing_value_approx != null) {
      updates.billing_value_final = row.billing_value_approx
    }

    await supabase.from('mandate_candidates').update(updates).eq('id', row.id)
    await logActivity({ candidateId: row.candidate_id, mandateId: row.mandate_id, applicantId: row.applicant_id, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
    onRefresh()
  }

  const statusOptions = stage ? (STAGE_STATUS_MAP[stage] ?? []) : []

  return (
    <>
      <tr
        className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors"
      >
        <TD className="font-mono text-xs text-[#999] whitespace-nowrap">
          {row.applicant_id ?? '—'}
        </TD>
        <TD>
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(c) }}
            className="font-medium text-[#0F0F12] block truncate max-w-[150px] cursor-pointer hover:text-[#5E6AD2] hover:underline"
          >{c.name ?? '—'}</span>
        </TD>
        <TD>
          <span className="text-[#666] block truncate max-w-[140px]">{c.skill_role ?? '—'}</span>
        </TD>
        <TD>
          <p className="text-xs font-medium text-[#0F0F12] truncate max-w-[170px]">
            {row.mandates?.clients?.name ?? '—'}
          </p>
          <p className="text-xs text-[#999] truncate max-w-[170px] mt-0.5">
            {row.mandates?.title ?? '—'}
          </p>
        </TD>
        <TD onClick={(e) => e.stopPropagation()}>
          <InlineDropdown
            badge={<StageBadge value={stage || null} />}
            options={getNextStageOptions(stage)}
            onSelect={handleStageChange}
          />
        </TD>
        <TD onClick={(e) => e.stopPropagation()}>
          <InlineDropdown
            badge={<StatusBadge value={status || null} />}
            options={statusOptions}
            onSelect={handleStatusChange}
            disabled={!stage}
          />
        </TD>
        <TD>
          <span className="text-[#666] block truncate max-w-[110px]">
            {row.linked_by_profile?.name ?? '—'}
          </span>
        </TD>
        <TD className="text-[#666]">
          {c.total_exp != null ? `${c.total_exp} yrs` : '—'}
        </TD>
        <TD className="text-xs text-[#999]">
          {formatRelativeDate(row.status_changed_at ?? row.linked_at)}
        </TD>
        {isTalentPool && (
          <TD onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onReassign({
                id: c.id,
                name: c.name,
                isReassignment: true,
                oldMcId: row.id,
                oldJobId: row.mandates?.job_id ?? null,
              })}
              className="h-6 px-2.5 rounded text-xs font-medium whitespace-nowrap text-[#5E6AD2] border border-[#5E6AD2]/30 hover:bg-[#5E6AD2]/10 transition"
            >
              Re-assign
            </button>
          </TD>
        )}
      </tr>
      {prompt && (
        <StagePromptModal
          type={prompt.type}
          mcId={row.id}
          supabaseClient={supabase}
          existingData={row}
          onClose={() => { setPrompt(null); onRefresh() }}
        />
      )}
    </>
  )
}

function MCTable({ rows, loading, onSelect, activeTab, onRefresh, onReassign }) {
  if (loading) return <LoadingState />
  if (rows.length === 0) return <EmptyState />

  const isTalentPool = activeTab === 'talent_pool'

  return (
    <table className="w-full min-w-[1020px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#FAFAFA]">
          <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
            <TH className="w-32">App ID</TH>
            <TH>Name</TH>
            <TH>Role</TH>
            <TH>Client · Mandate</TH>
            <TH className="w-28">Stage</TH>
            <TH className="w-36">Status</TH>
            <TH>Recruiter</TH>
            <TH className="w-20">Exp</TH>
            <TH className="w-28">Updated</TH>
            {isTalentPool && <TH className="w-24"></TH>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <MCRow
              key={row.id}
              row={row}
              onSelect={onSelect}
              activeTab={activeTab}
              onRefresh={onRefresh}
              onReassign={onReassign}
            />
          ))}
        </tbody>
    </table>
  )
}

// ─── Unassigned table ───────────────────────────────────────────────────────

function UnassignedTable({ rows, loading, onSelect, onAssign }) {
  if (loading) return <LoadingState />
  if (rows.length === 0) return <EmptyState message="No unassigned candidates" />

  return (
    <table className="w-full min-w-[820px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#FAFAFA]">
          <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
            <TH className="w-36">Candidate ID</TH>
            <TH>Name</TH>
            <TH>Role</TH>
            <TH className="w-32">Added</TH>
            <TH>Email</TH>
            <TH>Recruiter</TH>
            <TH className="w-24"></TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const bg  = unassignedRowBg(row.created_at)
            const age = daysSince(row.created_at)
            return (
              <tr
                key={row.id}
                className={`border-b border-[#F0F0F4] hover:opacity-90 transition-colors ${bg}`}
              >
                <TD className="font-mono text-xs text-[#999] whitespace-nowrap">{row.id}</TD>
                <TD>
                  <span
                    onClick={(e) => { e.stopPropagation(); onSelect(row) }}
                    className="font-medium text-[#0F0F12] block truncate max-w-[160px] cursor-pointer hover:text-[#5E6AD2] hover:underline"
                  >{row.name}</span>
                </TD>
                <TD>
                  <span className="text-[#666] block truncate max-w-[140px]">{row.skill_role ?? '—'}</span>
                </TD>
                <TD>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#666]">{formatRelativeDate(row.created_at)}</span>
                    {age >= 7 && (
                      <span className={`text-xs font-medium ${age >= 14 ? 'text-red-600' : 'text-amber-600'}`}>
                        {age}d
                      </span>
                    )}
                  </div>
                </TD>
                <TD>
                  <span className="text-xs text-[#666] block truncate max-w-[160px]">{row.email ?? '—'}</span>
                </TD>
                <TD>
                  <span className="text-[#666] block truncate max-w-[110px]">{row.profiles?.name ?? '—'}</span>
                </TD>
                <TD onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onAssign({ id: row.id, name: row.name })}
                    className="h-6 px-2.5 rounded text-xs font-medium text-[#5E6AD2] border border-[#5E6AD2]/30 hover:bg-[#5E6AD2]/10 transition"
                  >
                    Assign
                  </button>
                </TD>
              </tr>
            )
          })}
        </tbody>
    </table>
  )
}

// ─── All-candidates table ────────────────────────────────────────────────────

function AllCandidateRow({ row, onSelect, onRefresh }) {
  const { session } = useAuth()
  const mc = latestMC(row)

  const [stage, setStage]   = useState(mc?.stage ?? '')
  const [status, setStatus] = useState(mc?.status ?? '')
  const [prompt, setPrompt] = useState(null)

  const changedBy = session?.user?.id

  async function handleStageChange(newStage) {
    if (!mc) return
    const oldStage  = stage
    const oldStatus = status
    const newStatus = STAGE_STATUS_MAP[newStage]?.[0] ?? null

    setStage(newStage)
    setStatus(newStatus ?? '')

    await supabase.from('mandate_candidates')
      .update({ stage: newStage, status: newStatus, status_changed_at: new Date().toISOString() })
      .eq('id', mc.id)

    await logActivity({ candidateId: mc.candidate_id, mandateId: mc.mandate_id, applicantId: mc.applicant_id, changedBy, changeType: 'stage', oldValue: oldStage, newValue: newStage })
    if (oldStatus !== newStatus) {
      await logActivity({ candidateId: mc.candidate_id, mandateId: mc.mandate_id, applicantId: mc.applicant_id, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
    }

    if (newStage === 'Pre-L1 Assessment' || newStage === 'Post-L1 Assessment') {
      setPrompt({ type: 'assessment' })
    } else if (INTERVIEW_STAGES.has(newStage)) {
      setPrompt({ type: 'interview' })
    } else if (newStage === 'Offer') {
      setPrompt({ type: 'offer' })
    } else if (newStage === 'Joining') {
      setPrompt({ type: 'joining' })
    } else {
      onRefresh()
    }
  }

  async function handleStatusChange(newStatus) {
    if (!mc) return
    const oldStatus = status
    setStatus(newStatus)

    const updates = { status: newStatus, status_changed_at: new Date().toISOString() }
    if (newStatus === 'Invoice Raised' && mc.billing_value_approx != null) {
      updates.billing_value_final = mc.billing_value_approx
    }

    await supabase.from('mandate_candidates').update(updates).eq('id', mc.id)
    await logActivity({ candidateId: mc.candidate_id, mandateId: mc.mandate_id, applicantId: mc.applicant_id, changedBy, changeType: 'status', oldValue: oldStatus, newValue: newStatus })
    onRefresh()
  }

  const statusOptions = stage ? (STAGE_STATUS_MAP[stage] ?? []) : []

  return (
    <>
      <tr
        className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors"
      >
        <TD className="font-mono text-xs text-[#999] whitespace-nowrap">{row.id}</TD>
        <TD>
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(row) }}
            className="font-medium text-[#0F0F12] block truncate max-w-[150px] cursor-pointer hover:text-[#5E6AD2] hover:underline"
          >{row.name}</span>
        </TD>
        <TD>
          <span className="text-[#666] block truncate max-w-[140px]">{row.skill_role ?? '—'}</span>
        </TD>
        <TD>
          <span className="text-[#666] block truncate max-w-[120px]">{row.clients?.name ?? '—'}</span>
        </TD>
        <TD onClick={(e) => e.stopPropagation()}>
          {mc ? (
            <InlineDropdown
              badge={<StageBadge value={stage || null} />}
              options={getNextStageOptions(stage)}
              onSelect={handleStageChange}
            />
          ) : (
            <StageBadge value={null} />
          )}
        </TD>
        <TD onClick={(e) => e.stopPropagation()}>
          {mc ? (
            <InlineDropdown
              badge={<StatusBadge value={status || null} />}
              options={statusOptions}
              onSelect={handleStatusChange}
              disabled={!stage}
            />
          ) : (
            <StatusBadge value={null} />
          )}
        </TD>
        <TD>
          <span className="text-[#666] block truncate max-w-[110px]">{row.profiles?.name ?? '—'}</span>
        </TD>
        <TD className="text-[#666]">
          {row.total_exp != null ? `${row.total_exp} yrs` : '—'}
        </TD>
        <TD className="text-xs text-[#999]">{formatRelativeDate(row.created_at)}</TD>
      </tr>
      {prompt && mc && (
        <StagePromptModal
          type={prompt.type}
          mcId={mc.id}
          supabaseClient={supabase}
          existingData={mc}
          onClose={() => { setPrompt(null); onRefresh() }}
        />
      )}
    </>
  )
}

function AllCandidatesTable({ rows, loading, onSelect, onRefresh }) {
  if (loading) return <LoadingState />
  if (rows.length === 0) return <EmptyState message="No candidates found" />

  return (
    <table className="w-full min-w-[960px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#FAFAFA]">
          <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
            <TH className="w-36">Candidate ID</TH>
            <TH>Name</TH>
            <TH>Role</TH>
            <TH>Client</TH>
            <TH className="w-28">Stage</TH>
            <TH className="w-36">Status</TH>
            <TH>Recruiter</TH>
            <TH className="w-20">Exp</TH>
            <TH className="w-28">Added</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AllCandidateRow
              key={row.id}
              row={row}
              onSelect={onSelect}
              onRefresh={onRefresh}
            />
          ))}
        </tbody>
    </table>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const location = useLocation()
  const profile  = useProfile()
  const { session } = useAuth()
  const { isRecruiter, isAccountManager, isFounder } = useRole()

  const [activeTab, setActiveTab]   = useState('pipeline')
  const [amViewMode, setAmViewMode] = useState('my_submissions')
  const [page, setPage]             = useState(1)
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const [search, setSearch]               = useState('')
  const [stageFilter, setStageFilter]     = useState('')
  const [statusFilter, setStatusFilter]   = useState('')
  const [clientFilter, setClientFilter]   = useState('')
  const [recruiterFilter, setRecruiterFilter] = useState('')

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [pendingSelect, setPendingSelect]         = useState(null)
  const [assignTarget, setAssignTarget]           = useState(null)
  const [assignToast, setAssignToast]             = useState('')

  const isMCTab       = MC_TABS.has(activeTab)
  const isNewLayoutTab = NEW_LAYOUT_TABS.has(activeTab)

  // Auto-open panel when navigated from duplicate detection flow
  useEffect(() => {
    const openId = location.state?.openCandidateId
    if (!openId) return
    window.history.replaceState({}, '')
    supabase
      .from('candidates')
      .select(CANDIDATE_FIELDS)
      .eq('id', openId)
      .single()
      .then(({ data }) => { if (data) setSelectedCandidate(data) })
  }, [location.state?.openCandidateId])

  // ── data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile || !session) return

    async function fetchData() {
      setLoading(true)
      setError(null)
      const userId = session.user.id
      const role   = profile.role

      if (isMCTab) {
        const statusList =
          activeTab === 'pipeline'    ? ACTIVE_STATUSES :
          activeTab === 'active'      ? ACTIVE_STATUSES :
          activeTab === 'talent_pool' ? TALENT_POOL_STATUSES :
          PLACED_STATUSES

        let query = supabase
          .from('mandate_candidates')
          .select(MC_SELECT)
          .in('status', statusList)
          .order('status_changed_at', { ascending: false, nullsFirst: false })

        if (activeTab === 'pipeline') {
          query = query.in('stage', L2_ABOVE_STAGES)
        }

        if (role === 'recruiter') {
          query = query.eq('linked_by', userId)
        } else if (role === 'account_manager') {
          if (amViewMode === 'my_submissions') {
            query = query.eq('linked_by', userId)
          } else {
            const { data: myMandates } = await supabase
              .from('mandates')
              .select('id')
              .eq('am_id', userId)
            const mandateIds = (myMandates ?? []).map((m) => m.id)
            if (mandateIds.length === 0) {
              setRows([])
              setLoading(false)
              return
            }
            query = query.in('mandate_id', mandateIds)
          }
        }

        const { data, error: err } = await query
        if (err) setError(err.message)
        else setRows(data ?? [])

      } else if (activeTab === 'unassigned') {
        const { data: linked } = await supabase
          .from('mandate_candidates')
          .select('candidate_id')

        const linkedIds = [...new Set((linked ?? []).map((r) => r.candidate_id))]

        let query = supabase
          .from('candidates')
          .select(UNASSIGNED_SELECT)
          .order('created_at', { ascending: false })

        if (role === 'recruiter') {
          query = query.eq('recruiter_id', userId)
        } else if (role === 'account_manager' && amViewMode === 'my_submissions') {
          query = query.eq('recruiter_id', userId)
        }

        if (linkedIds.length > 0) {
          query = query.not('id', 'in', `(${linkedIds.join(',')})`)
        }

        const { data, error: err } = await query
        if (err) setError(err.message)
        else setRows(data ?? [])

      } else {
        // all
        let query = supabase
          .from('candidates')
          .select(ALL_SELECT)
          .order('created_at', { ascending: false })

        if (role === 'recruiter') {
          query = query.eq('recruiter_id', userId)
        } else if (role === 'account_manager' && amViewMode === 'my_submissions') {
          query = query.eq('recruiter_id', userId)
        }

        const { data, error: err } = await query
        if (err) setError(err.message)
        else setRows(data ?? [])
      }

      setLoading(false)
    }

    fetchData()
  }, [profile, session, activeTab, amViewMode, refreshToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── filter options derived from rows ────────────────────────────────────────
  const stages = useMemo(() => {
    if (isMCTab && !isNewLayoutTab) return [...new Set(rows.map((r) => r.stage).filter(Boolean))].sort()
    if (activeTab === 'all') return [...new Set(rows.map((r) => latestMC(r)?.stage).filter(Boolean))].sort()
    return []
  }, [rows, isMCTab, isNewLayoutTab, activeTab])

  const statusOptions = useMemo(() => {
    if (!isMCTab && activeTab !== 'all') return []
    if (stageFilter) return STAGE_STATUS_MAP[stageFilter] ?? []
    if (isNewLayoutTab) return ALL_STATUSES_FLAT
    if (activeTab === 'all') return [...new Set(rows.map((r) => latestMC(r)?.status).filter(Boolean))].sort()
    return [...new Set(rows.map((r) => r.status).filter(Boolean))].sort()
  }, [rows, isMCTab, isNewLayoutTab, stageFilter, activeTab])

  const clients = useMemo(() => {
    const seen = new Map()
    if (isMCTab) {
      rows.forEach((r) => {
        const c = r.mandates?.clients
        if (c?.id) seen.set(c.id, c)
      })
    } else {
      // unassigned and all tabs: client is a direct field on the candidate row
      rows.forEach((r) => {
        const c = r.clients
        if (c?.id) seen.set(c.id, c)
      })
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, isMCTab])

  const recruiters = useMemo(() => {
    const seen = new Map()
    if (isMCTab) {
      rows.forEach((r) => {
        const p = r.linked_by_profile
        if (p?.id) seen.set(p.id, { id: r.linked_by, name: p.name })
      })
    } else {
      rows.forEach((r) => {
        const p = r.profiles
        if (p?.id) seen.set(r.recruiter_id, { id: r.recruiter_id, name: p.name })
      })
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, isMCTab])

  // ── client-side filtering ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter((r) => {
      if (isNewLayoutTab) {
        const c = r.candidates ?? {}
        if (q && !c.name?.toLowerCase().includes(q) &&
            !c.phone?.toLowerCase().includes(q) &&
            !c.email?.toLowerCase().includes(q)) return false
        if (clientFilter && r.mandates?.clients?.id !== clientFilter) return false
        if (stageFilter && r.stage !== stageFilter) return false
        if (statusFilter && r.status !== statusFilter) return false
        if (recruiterFilter && r.linked_by !== recruiterFilter) return false
      } else if (isMCTab) {
        const c = r.candidates ?? {}
        if (q && !c.name?.toLowerCase().includes(q) && !c.skill_role?.toLowerCase().includes(q)) return false
        if (stageFilter && r.stage !== stageFilter) return false
        if (statusFilter && r.status !== statusFilter) return false
        if (clientFilter && r.mandates?.clients?.id !== clientFilter) return false
        if (recruiterFilter && r.linked_by !== recruiterFilter) return false
      } else if (activeTab === 'all') {
        if (q && !r.name?.toLowerCase().includes(q) &&
            !r.skill_role?.toLowerCase().includes(q) &&
            !r.email?.toLowerCase().includes(q)) return false
        if (clientFilter && r.clients?.id !== clientFilter) return false
        const mc = latestMC(r)
        if (stageFilter && mc?.stage !== stageFilter) return false
        if (statusFilter && mc?.status !== statusFilter) return false
        if (recruiterFilter && r.recruiter_id !== recruiterFilter) return false
      } else {
        // unassigned
        if (q && !r.name?.toLowerCase().includes(q) &&
            !r.skill_role?.toLowerCase().includes(q) &&
            !r.email?.toLowerCase().includes(q)) return false
        if (clientFilter && r.clients?.id !== clientFilter) return false
        if (recruiterFilter && r.recruiter_id !== recruiterFilter) return false
      }
      return true
    })
  }, [rows, search, stageFilter, statusFilter, clientFilter, recruiterFilter, isMCTab, isNewLayoutTab, activeTab])

  useEffect(() => { setPage(1) }, [activeTab, search, stageFilter, statusFilter, clientFilter, recruiterFilter])

  function handleTabChange(tab) {
    setActiveTab(tab)
    setSearch('')
    setStageFilter('')
    setStatusFilter('')
    setClientFilter('')
    setRecruiterFilter('')
    setPage(1)
  }

  function handleSelect(candidate) {
    if (!selectedCandidate) {
      setSelectedCandidate(candidate)
    } else if (selectedCandidate.id !== candidate.id) {
      setPendingSelect(candidate)
    }
  }

  const hasActiveFilters = search || stageFilter || statusFilter || clientFilter || recruiterFilter

  const paginated = useMemo(
    () => filtered.slice((page - 1) * 50, page * 50),
    [filtered, page]
  )

  return (
    <AppShell title="Candidates">
      <div className="flex flex-col h-full">

        {/* AM view-mode toggle */}
        {isAccountManager && (
          <div className="px-6 pt-3 pb-0 flex items-center gap-2">
            <span className="text-xs text-[#999] font-medium mr-1">View:</span>
            {[
              { id: 'my_submissions', label: 'My Submissions' },
              { id: 'my_mandates',   label: 'My Mandates' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setAmViewMode(id)}
                className={`h-7 px-3 rounded-full text-xs font-medium transition ${
                  amViewMode === id
                    ? 'bg-[#5E6AD2] text-white'
                    : 'bg-[#F0F0F4] text-[#666] hover:bg-[#E8E8EE]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="px-6 border-b border-[#F0F0F4] bg-white flex items-center gap-1 shrink-0 mt-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-[#5E6AD2] text-[#5E6AD2]'
                  : 'border-transparent text-[#999] hover:text-[#666]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-[#F0F0F4] bg-white flex items-center gap-3 flex-wrap shrink-0">
          {/* Search — all tabs */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none"
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
            >
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10.5 10.5l3 3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder={
                isNewLayoutTab ? 'Search name, phone or email…' :
                isMCTab        ? 'Search name or role…' :
                                 'Search name, role or email…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-56"
            />
          </div>

          {/* Client — all tabs */}
          <SelectFilter value={clientFilter} onChange={setClientFilter} placeholder="All clients">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectFilter>

          {/* Stage — MC tabs + All (not Unassigned) */}
          {(isMCTab || activeTab === 'all') && (
            <SelectFilter
              value={stageFilter}
              onChange={(v) => { setStageFilter(v); setStatusFilter('') }}
              placeholder="All stages"
            >
              {(isNewLayoutTab ? STAGES : stages).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </SelectFilter>
          )}

          {/* Status — MC tabs + All (not Unassigned) */}
          {(isMCTab || activeTab === 'all') && (
            <SelectFilter value={statusFilter} onChange={setStatusFilter} placeholder="All statuses">
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectFilter>
          )}

          {/* Recruiter — all tabs, non-recruiter users only */}
          {!isRecruiter && recruiters.length > 0 && (
            <SelectFilter value={recruiterFilter} onChange={setRecruiterFilter} placeholder="All recruiters">
              {recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectFilter>
          )}

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearch(''); setStageFilter(''); setStatusFilter('')
                setClientFilter(''); setRecruiterFilter('')
              }}
              className="text-xs text-[#5E6AD2] hover:underline ml-1"
            >
              Clear filters
            </button>
          )}

          <span className="text-xs text-[#999] ml-auto">
            {loading ? '…' : `${filtered.length} candidate${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            Failed to load candidates: {error}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isNewLayoutTab ? (
            <NewMCTable
              rows={paginated}
              loading={loading}
              onSelect={handleSelect}
              onRefresh={() => setRefreshToken((t) => t + 1)}
            />
          ) : isMCTab ? (
            <MCTable
              rows={paginated}
              loading={loading}
              onSelect={handleSelect}
              activeTab={activeTab}
              onRefresh={() => setRefreshToken((t) => t + 1)}
              onReassign={setAssignTarget}
            />
          ) : activeTab === 'unassigned' ? (
            <UnassignedTable
              rows={paginated}
              loading={loading}
              onSelect={handleSelect}
              onAssign={setAssignTarget}
            />
          ) : (
            <AllCandidatesTable
              rows={paginated}
              loading={loading}
              onSelect={handleSelect}
              onRefresh={() => setRefreshToken((t) => t + 1)}
            />
          )}
        </div>
        {!loading && filtered.length > 0 && (
          <Pagination total={filtered.length} page={page} onChange={setPage} />
        )}
      </div>

      <CandidatePanel
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onUpdate={() => {
          setSelectedCandidate(null)
          setRefreshToken((t) => t + 1)
        }}
        pendingSelect={pendingSelect}
        onPendingResolved={(candidate) => {
          setSelectedCandidate(candidate)
          setPendingSelect(null)
        }}
        onPendingCancelled={() => setPendingSelect(null)}
      />

      {assignTarget && (
        <AssignMandateModal
          candidateId={assignTarget.id}
          candidateName={assignTarget.name}
          onClose={() => setAssignTarget(null)}
          onAssigned={async (appId, newMandate) => {
            if (assignTarget.isReassignment) {
              logActivity({
                candidateId: assignTarget.id,
                mandateId: newMandate.mandateId,
                applicantId: appId,
                changedBy: session?.user?.id,
                changeType: 'reassigned_from_talent_pool',
                oldValue: assignTarget.oldJobId,
                newValue: newMandate.jobId,
              })
              await supabase
                .from('mandate_candidates')
                .update({ status: null })
                .eq('id', assignTarget.oldMcId)
              setAssignToast(`Re-assigned as ${appId}`)
            } else {
              setAssignToast(`Assigned as ${appId}`)
            }
            setAssignTarget(null)
            setTimeout(() => setAssignToast(''), 4000)
            setRefreshToken((t) => t + 1)
          }}
        />
      )}

      <SuccessToast
        message={assignToast || null}
        onDismiss={() => setAssignToast('')}
      />
    </AppShell>
  )
}
