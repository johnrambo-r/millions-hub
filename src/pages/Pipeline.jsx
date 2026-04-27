import { useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { StageBadge, StatusBadge } from '../components/pipeline/StageBadge'
import CandidatePanel from '../components/pipeline/CandidatePanel'
import { useProfile } from '../hooks/useProfile'
import { usePipelineData } from '../hooks/usePipelineData'

// ─── helpers ───────────────────────────────────────────────────────────────

function formatRelativeDate(str) {
  if (!str) return '—'
  const days = Math.floor((Date.now() - new Date(str).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

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

// ─── table ─────────────────────────────────────────────────────────────────

const TH = ({ children, className = '' }) => (
  <th className={`px-4 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap ${className}`}>
    {children}
  </th>
)

const TD = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
)

function PipelineTable({ rows, loading, onSelect }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#999]">
        Loading candidates…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#999]">
        No candidates match the current filters
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse">
        <thead>
          <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
            <TH className="w-36">ID</TH>
            <TH>Name</TH>
            <TH>Role</TH>
            <TH>Client</TH>
            <TH className="w-28">Stage</TH>
            <TH className="w-36">Status</TH>
            <TH>Recruiter</TH>
            <TH className="w-24">Exp</TH>
            <TH className="w-28">Updated</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
            >
              <TD className="font-mono text-xs text-[#999] whitespace-nowrap">
                {row.id}
              </TD>
              <TD>
                <span className="font-medium text-[#0F0F12] block truncate max-w-[150px]">
                  {row.name}
                </span>
              </TD>
              <TD>
                <span className="text-[#666] block truncate max-w-[140px]">{row.skill_role ?? '—'}</span>
              </TD>
              <TD>
                <span className="text-[#666] block truncate max-w-[120px]">{row.clients?.name ?? '—'}</span>
              </TD>
              <TD><StageBadge value={row.stage} /></TD>
              <TD><StatusBadge value={row.status} /></TD>
              <TD>
                <span className="text-[#666] block truncate max-w-[120px]">{row.profiles?.name ?? '—'}</span>
              </TD>
              <TD className="text-[#666]">{row.total_exp != null ? `${row.total_exp} yrs` : '—'}</TD>
              <TD className="text-xs text-[#999]">{formatRelativeDate(row.status_changed_at)}</TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const profile = useProfile()
  const [refreshToken, setRefreshToken] = useState(0)
  const { rows, loading, error } = usePipelineData(profile, refreshToken)

  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [recruiterFilter, setRecruiterFilter] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  // Derive unique filter options from loaded data
  const stages = useMemo(
    () => [...new Set(rows.map((r) => r.stage).filter(Boolean))].sort(),
    [rows]
  )
  const clients = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => { if (r.clients?.id) seen.set(r.clients.id, r.clients) })
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])
  const recruiters = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => { if (r.profiles?.id) seen.set(r.profiles.id, r.profiles) })
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter((r) => {
      if (q && !r.name?.toLowerCase().includes(q) && !r.skill_role?.toLowerCase().includes(q)) return false
      if (stageFilter && r.stage !== stageFilter) return false
      if (clientFilter && r.clients?.id !== clientFilter) return false
      if (recruiterFilter && r.recruiter_id !== recruiterFilter) return false
      return true
    })
  }, [rows, search, stageFilter, clientFilter, recruiterFilter])

  const isManager = profile?.role !== 'recruiter'

  return (
    <AppShell title="Pipeline">
      <div className="flex flex-col h-full">

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-[#F0F0F4] bg-white flex items-center gap-3 flex-wrap shrink-0">
          {/* Search */}
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
              placeholder="Search name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-56"
            />
          </div>

          <SelectFilter value={stageFilter} onChange={setStageFilter} placeholder="All stages">
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectFilter>

          <SelectFilter value={clientFilter} onChange={setClientFilter} placeholder="All clients">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectFilter>

          {isManager && (
            <SelectFilter value={recruiterFilter} onChange={setRecruiterFilter} placeholder="All recruiters">
              {recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectFilter>
          )}

          {/* Active filter count + clear */}
          {(search || stageFilter || clientFilter || recruiterFilter) && (
            <button
              onClick={() => { setSearch(''); setStageFilter(''); setClientFilter(''); setRecruiterFilter('') }}
              className="text-xs text-[#5E6AD2] hover:underline ml-1"
            >
              Clear filters
            </button>
          )}

          {/* Row count */}
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
          <PipelineTable rows={filtered} loading={loading} onSelect={setSelectedCandidate} />
        </div>
      </div>

      {/* Detail panel */}
      <CandidatePanel
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onUpdate={(updated) => {
          setSelectedCandidate((prev) => prev ? { ...prev, ...updated } : prev)
          setRefreshToken((t) => t + 1)
        }}
      />
    </AppShell>
  )
}
