import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { supabase } from '../lib/supabase'
import UnsavedChangesModal from '../components/UnsavedChangesModal'
import useRole from '../hooks/useRole'

// ─── Constants ──────────────────────────────────────────────────────────────

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
  high: 'bg-red-50 text-red-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-gray-100 text-gray-500',
}
const CLIENT_RESPONSE_STYLES = {
  shortlisted: 'bg-green-50 text-green-700',
  rejected:    'bg-red-50 text-red-700',
  on_hold:     'bg-amber-50 text-amber-700',
}
const CLIENT_RESPONSE_LABELS = {
  shortlisted: 'Shortlisted', rejected: 'Rejected', on_hold: 'On Hold',
}
const WORK_MODE_LABELS    = { onsite: 'Onsite', hybrid: 'Hybrid', remote: 'Remote' }
const EMPLOYMENT_LABELS   = { full_time: 'Full-time', contract: 'Contract', contract_to_hire: 'Contract to Hire' }

const EDITABLE_FIELDS = [
  'title', 'status', 'priority', 'num_positions',
  'experience_min', 'experience_max', 'location', 'work_mode',
  'employment_type', 'budget_min', 'budget_max', 'budget_currency',
  'internal_notes', 'jd_text', 'am_id',
]

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

// ─── Shared small components ─────────────────────────────────────────────────

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

function StatusBadge({ value }) {
  if (!value) return <span className="text-sm text-[#999]">—</span>
  const cls = STATUS_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {STATUS_LABELS[value] ?? value}
    </span>
  )
}

function PriorityBadge({ value }) {
  if (!value) return <span className="text-sm text-[#999]">—</span>
  const cls = PRIORITY_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  )
}

function ClientResponseBadge({ value }) {
  if (!value) return <span className="text-xs text-[#999]">—</span>
  const cls = CLIENT_RESPONSE_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {CLIENT_RESPONSE_LABELS[value] ?? value}
    </span>
  )
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── JD collapsible ──────────────────────────────────────────────────────────

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
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-xs text-[#5E6AD2] hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

// ─── Link Candidate Modal ────────────────────────────────────────────────────

function LinkCandidateModal({ mandateId, linkedIds, onLink, onClose }) {
  const [search, setSearch]     = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking]   = useState(null)

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('candidates')
        .select('id, name, skill_role, email')
        .ilike('name', `%${search}%`)
        .limit(10)
      setResults(data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
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
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10.5 10.5l3 3" strokeLinecap="round" />
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
          {!searching && search && results.length === 0 && (
            <p className="text-sm text-[#999]">No candidates found.</p>
          )}
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

// ─── Candidates tab ──────────────────────────────────────────────────────────

function CandidatesTab({ mandateId, mandateCandidates, loading, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const linkedIds = new Set(mandateCandidates.map((mc) => mc.candidate_id))

  if (loading) return <p className="text-sm text-[#999]">Loading candidates…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#999]">
          {mandateCandidates.length} candidate{mandateCandidates.length !== 1 ? 's' : ''} linked
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="h-8 px-3 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 flex items-center gap-1.5"
          style={{ backgroundColor: '#5E6AD2' }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          Link Candidate
        </button>
      </div>

      {mandateCandidates.length === 0 ? (
        <p className="text-sm text-[#999]">No candidates linked to this mandate yet.</p>
      ) : (
        <ul className="space-y-2">
          {mandateCandidates.map((mc) => (
            <li key={mc.id} className="rounded-lg border border-[#F0F0F4] px-4 py-3 bg-[#FAFAFA]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F0F12] truncate">{mc.candidate?.name ?? '—'}</p>
                  {mc.candidate?.skill_role && (
                    <p className="text-xs text-[#666] mt-0.5 truncate">{mc.candidate.skill_role}</p>
                  )}
                  <p className="text-xs text-[#999] mt-0.5">Linked {formatDate(mc.linked_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {mc.candidate?.stage && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                      {mc.candidate.stage}
                    </span>
                  )}
                  {mc.candidate?.status && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 whitespace-nowrap">
                      {mc.candidate.status}
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${mc.submitted_to_client ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {mc.submitted_to_client ? 'Submitted' : 'Not submitted'}
                  </span>
                  {mc.client_response && <ClientResponseBadge value={mc.client_response} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
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

// ─── Submissions tab ─────────────────────────────────────────────────────────

function SubmissionsTab({ mandateCandidates, loading, onUpdateResponse }) {
  const [updating, setUpdating] = useState(null)
  const submitted = mandateCandidates.filter((mc) => mc.submitted_to_client)

  if (loading) return <p className="text-sm text-[#999]">Loading submissions…</p>
  if (submitted.length === 0) {
    return <p className="text-sm text-[#999]">No candidates have been submitted to the client yet.</p>
  }

  async function handleResponseChange(mc, value) {
    setUpdating(mc.id)
    await supabase
      .from('mandate_candidates')
      .update({
        client_response:    value || null,
        client_response_at: value ? new Date().toISOString() : null,
      })
      .eq('id', mc.id)
    setUpdating(null)
    onUpdateResponse()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider">Candidate</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap">Submitted</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider w-40">Client Response</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap">Response Date</th>
          </tr>
        </thead>
        <tbody>
          {submitted.map((mc) => (
            <tr key={mc.id} className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors">
              <td className="px-3 py-3">
                <p className="font-medium text-[#0F0F12] truncate max-w-[160px]">{mc.candidate?.name ?? '—'}</p>
                {mc.candidate?.skill_role && (
                  <p className="text-xs text-[#666] mt-0.5 truncate max-w-[160px]">{mc.candidate.skill_role}</p>
                )}
              </td>
              <td className="px-3 py-3 text-[#666] whitespace-nowrap">{formatDate(mc.submitted_at)}</td>
              <td className="px-3 py-3">
                <select
                  value={mc.client_response ?? ''}
                  onChange={(e) => handleResponseChange(mc, e.target.value)}
                  disabled={updating === mc.id}
                  className="h-7 w-full rounded-md border border-[#F0F0F4] bg-white px-2 text-xs text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition disabled:opacity-50"
                >
                  <option value="">No response</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="rejected">Rejected</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </td>
              <td className="px-3 py-3 text-[#666] whitespace-nowrap">{formatDate(mc.client_response_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Read view ───────────────────────────────────────────────────────────────

function ReadView({ mandate }) {
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-[#0F0F12] mb-2 leading-snug">{mandate.title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge value={mandate.status} />
          <PriorityBadge value={mandate.priority} />
        </div>
      </div>

      <hr className="border-[#F0F0F4]" />

      <div>
        <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Details</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
          <Field label="Client">
            {mandate.client ? (
              <Link to="/clients" className="text-[#5E6AD2] hover:underline">
                {mandate.client.name}
              </Link>
            ) : null}
          </Field>
          <Field label="Account Manager">{mandate.am?.name}</Field>
          <Field label="Positions">{mandate.num_positions}</Field>
          <Field label="Experience">{expDisplay}</Field>
          <Field label="Location">{mandate.location}</Field>
          <Field label="Work Mode">{WORK_MODE_LABELS[mandate.work_mode] ?? mandate.work_mode}</Field>
          <Field label="Employment Type">{EMPLOYMENT_LABELS[mandate.employment_type] ?? mandate.employment_type}</Field>
          <Field label="Budget">{budgetDisplay}</Field>
          <Field label="Created">{formatDate(mandate.created_at)}</Field>
        </dl>
      </div>

      {mandate.internal_notes && (
        <>
          <hr className="border-[#F0F0F4]" />
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">Internal Notes</h3>
            <p className="text-sm text-[#666] leading-relaxed whitespace-pre-wrap">{mandate.internal_notes}</p>
          </div>
        </>
      )}

      {mandate.jd_text && (
        <>
          <hr className="border-[#F0F0F4]" />
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">Job Description</h3>
            <JDTextCollapsible text={mandate.jd_text} />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Edit view ───────────────────────────────────────────────────────────────

function EditView({ editFields, setEditField, amProfiles, recruiterProfiles, selectedRecruiters, toggleRecruiter }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Mandate Details</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <EditField label="Title" colSpan2>
            <input
              type="text"
              value={editFields.title || ''}
              onChange={(e) => setEditField('title', e.target.value)}
              className={fldCls}
              placeholder="e.g. Senior Backend Engineer"
            />
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
            <input
              type="number"
              min="1"
              value={editFields.num_positions || ''}
              onChange={(e) => setEditField('num_positions', e.target.value)}
              className={fldCls}
            />
          </EditField>
          <EditField label="Exp. Min (yrs)">
            <input
              type="number"
              min="0"
              value={editFields.experience_min ?? ''}
              onChange={(e) => setEditField('experience_min', e.target.value)}
              className={fldCls}
              placeholder="0"
            />
          </EditField>
          <EditField label="Exp. Max (yrs)">
            <input
              type="number"
              min="0"
              value={editFields.experience_max ?? ''}
              onChange={(e) => setEditField('experience_max', e.target.value)}
              className={fldCls}
              placeholder="10"
            />
          </EditField>
          <EditField label="Location" colSpan2>
            <input
              type="text"
              value={editFields.location || ''}
              onChange={(e) => setEditField('location', e.target.value)}
              className={fldCls}
              placeholder="e.g. Bengaluru, Remote"
            />
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
            <input
              type="text"
              value={editFields.budget_currency || ''}
              onChange={(e) => setEditField('budget_currency', e.target.value)}
              className={fldCls}
              placeholder="INR"
            />
          </EditField>
          <EditField label="Budget Min">
            <input
              type="number"
              min="0"
              value={editFields.budget_min ?? ''}
              onChange={(e) => setEditField('budget_min', e.target.value)}
              className={fldCls}
            />
          </EditField>
          <EditField label="Budget Max">
            <input
              type="number"
              min="0"
              value={editFields.budget_max ?? ''}
              onChange={(e) => setEditField('budget_max', e.target.value)}
              className={fldCls}
            />
          </EditField>
        </div>
      </div>

      <hr className="border-[#F0F0F4]" />

      <div>
        <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Team</h3>
        <div>
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
        </div>
      </div>

      <hr className="border-[#F0F0F4]" />

      <div>
        <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Notes &amp; JD</h3>
        <div className="space-y-5">
          <EditField label="Internal Notes">
            <textarea
              value={editFields.internal_notes || ''}
              onChange={(e) => setEditField('internal_notes', e.target.value)}
              rows={3}
              className={`${fldCls} h-auto py-2 resize-none`}
              placeholder="Internal notes…"
            />
          </EditField>
          <EditField label="Job Description">
            <textarea
              value={editFields.jd_text || ''}
              onChange={(e) => setEditField('jd_text', e.target.value)}
              rows={8}
              className={`${fldCls} h-auto py-2 resize-none`}
              placeholder="Paste or type the JD…"
            />
          </EditField>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function initEditFields(mandate) {
  const fields = {}
  EDITABLE_FIELDS.forEach((k) => { fields[k] = mandate?.[k] ?? '' })
  return fields
}

export default function MandatePanel() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isRecruiter } = useRole()

  const [mandate, setMandate]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [fetchError, setFetchError]         = useState('')
  const [mandateCandidates, setMandateCandidates] = useState([])
  const [candidatesLoading, setCandidatesLoading] = useState(true)
  const [amProfiles, setAmProfiles]         = useState([])

  const [isEditing, setIsEditing]           = useState(false)
  const [editFields, setEditFields]         = useState({})
  const [isDirty, setIsDirty]               = useState(false)
  const [editSaving, setEditSaving]         = useState(false)
  const [editError, setEditError]           = useState('')
  const [editSuccess, setEditSuccess]       = useState(false)
  const [dialog, setDialog]                 = useState(null)
  const [dialogSaving, setDialogSaving]     = useState(false)
  const [activeTab, setActiveTab]           = useState('candidates')
  const [recruiterProfiles, setRecruiterProfiles] = useState([])
  const [mandateRecruiters, setMandateRecruiters] = useState([])
  const [selectedRecruiters, setSelectedRecruiters] = useState([])

  const originalFieldsRef = useRef({})
  const originalRecruitersRef = useRef([])

  // ── Fetch mandate ─────────────────────────────────────────────────────
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

  // ── Fetch AM profiles ─────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, role')
      .in('role', ['account_manager', 'founder'])
      .eq('active', true)
      .order('name')
      .then(({ data }) => setAmProfiles(data ?? []))
  }, [])

  // ── Fetch recruiter profiles ──────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'recruiter')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setRecruiterProfiles(data ?? []))
  }, [])

  // ── Fetch mandate recruiters ──────────────────────────────────────────
  function fetchMandateRecruiters() {
    if (!id) return
    supabase
      .from('mandate_recruiters')
      .select('recruiter_id')
      .eq('mandate_id', id)
      .then(({ data }) => setMandateRecruiters(data ?? []))
  }

  useEffect(() => { fetchMandateRecruiters() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch mandate candidates ──────────────────────────────────────────
  function fetchCandidates() {
    if (!id) return
    setCandidatesLoading(true)
    supabase
      .from('mandate_candidates')
      .select('*, candidate:candidates!candidate_id(id, name, skill_role, email, stage, status)')
      .eq('mandate_id', id)
      .order('linked_at', { ascending: false })
      .then(({ data }) => {
        setMandateCandidates(data ?? [])
        setCandidatesLoading(false)
      })
  }

  useEffect(() => { fetchCandidates() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dirty tracking ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditing) return
    const orig = originalFieldsRef.current
    const fieldsDirty = EDITABLE_FIELDS.some((k) => String(editFields[k] ?? '') !== String(orig[k] ?? ''))
    const origSet = new Set(originalRecruitersRef.current)
    const curSet = new Set(selectedRecruiters)
    const recruitersDirty = origSet.size !== curSet.size || [...origSet].some((rid) => !curSet.has(rid))
    setIsDirty(fieldsDirty || recruitersDirty)
  }, [editFields, selectedRecruiters, isEditing])

  useEffect(() => {
    if (isDirty) window.onbeforeunload = () => true
    else window.onbeforeunload = null
    return () => { window.onbeforeunload = null }
  }, [isDirty])

  // ── Edit helpers ──────────────────────────────────────────────────────
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
  }

  function toggleRecruiter(rid) {
    setSelectedRecruiters((prev) =>
      prev.includes(rid) ? prev.filter((r) => r !== rid) : [...prev, rid]
    )
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
        message: 'Do you want to save your changes before cancelling?',
        onSave: async () => {
          setDialogSaving(true)
          await performSave()
          setDialogSaving(false)
          setDialog(null)
        },
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

    if (err) {
      setEditError(err.message)
      return false
    }

    setMandate(data)

    // ── Recruiter diff ───────────────────────────────────────────────────
    const origSet = new Set(originalRecruitersRef.current)
    const newSet = new Set(selectedRecruiters)
    const toAdd = [...newSet].filter((rid) => !origSet.has(rid))
    const toRemove = [...origSet].filter((rid) => !newSet.has(rid))

    if (toAdd.length > 0) {
      const rows = toAdd.map((rid) => ({ mandate_id: id, recruiter_id: rid }))
      const { error: addErr } = await supabase.from('mandate_recruiters').insert(rows)
      if (addErr) { setEditError(addErr.message); setEditSaving(false); return false }
    }
    if (toRemove.length > 0) {
      const { error: removeErr } = await supabase
        .from('mandate_recruiters')
        .delete()
        .eq('mandate_id', id)
        .in('recruiter_id', toRemove)
      if (removeErr) { setEditError(removeErr.message); setEditSaving(false); return false }
    }

    originalRecruitersRef.current = [...newSet]
    fetchMandateRecruiters()

    setIsEditing(false)
    setIsDirty(false)
    setEditSuccess(true)
    setTimeout(() => setEditSuccess(false), 3000)
    return true
  }

  // ── Loading / error screens ───────────────────────────────────────────
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

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <AppShell title={mandate.title}>
      <div className="flex flex-col h-full">

        {/* Page header */}
        <div className="px-6 py-4 border-b border-[#F0F0F4] bg-white flex items-center justify-between shrink-0 gap-4">
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
            <h1 className="text-base font-semibold text-[#0F0F12] truncate">{mandate.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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

        {/* Banners */}
        {editSuccess && (
          <div className="mx-6 mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 shrink-0">
            Changes saved successfully.
          </div>
        )}
        {editError && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shrink-0">
            {editError}
          </div>
        )}

        {/* Two-column body */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* Left — mandate details */}
          <div className="flex-[3] overflow-y-auto px-6 py-6 border-r border-[#F0F0F4]">
            {isEditing
              ? <EditView editFields={editFields} setEditField={setEditField} amProfiles={amProfiles} recruiterProfiles={recruiterProfiles} selectedRecruiters={selectedRecruiters} toggleRecruiter={toggleRecruiter} />
              : <ReadView mandate={mandate} />
            }
          </div>

          {/* Right — tabbed panel */}
          <div className="flex-[2] flex flex-col min-h-0">
            <div className="flex border-b border-[#F0F0F4] px-5 shrink-0 bg-white">
              {['candidates', 'submissions'].map((tab) => (
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
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {activeTab === 'candidates' && (
                <CandidatesTab
                  mandateId={id}
                  mandateCandidates={mandateCandidates}
                  loading={candidatesLoading}
                  onRefresh={fetchCandidates}
                />
              )}
              {activeTab === 'submissions' && (
                <SubmissionsTab
                  mandateCandidates={mandateCandidates}
                  loading={candidatesLoading}
                  onUpdateResponse={fetchCandidates}
                />
              )}
            </div>
          </div>
        </div>
      </div>

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
