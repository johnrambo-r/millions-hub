import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { useMandatesData } from '../hooks/useMandatesData'
import Pagination from '../components/Pagination'
import FilterPill from '../components/FilterPill'

// ─── badges ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:    'bg-green-50 text-green-700',
  on_hold:   'bg-amber-50 text-amber-700',
  closed:    'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-700',
}

const STATUS_LABELS = {
  active:    'Active',
  on_hold:   'On Hold',
  closed:    'Closed',
  cancelled: 'Cancelled',
}

const PRIORITY_STYLES = {
  high:   'bg-red-50 text-red-700',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-gray-100 text-gray-500',
}

function StatusBadge({ value }) {
  if (!value) return <span className="text-sm text-[#999]">—</span>
  const cls = STATUS_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {STATUS_LABELS[value] ?? value}
    </span>
  )
}

function PriorityBadge({ value }) {
  if (!value) return <span className="text-sm text-[#999]">—</span>
  const cls = PRIORITY_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  )
}

// ─── helpers ───────────────────────────────────────────────────────────────

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

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

function MandatesTable({ rows, loading, onSelect, hasFilters }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#999]">
        Loading mandates…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-sm text-[#999]">
        {hasFilters ? (
          <span>No mandates match the current filters</span>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-[#D0D0D8]">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" strokeLinecap="round" />
            </svg>
            <span>No mandates yet</span>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full min-w-[860px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#FAFAFA]">
              <tr className="border-b border-[#F0F0F4]">
                <TH className="w-36">Job ID</TH>
                <TH>Title</TH>
                <TH>Client</TH>
                <TH>AM</TH>
                <TH className="w-32">Status</TH>
                <TH className="w-28">Priority</TH>
                <TH className="w-24">Positions</TH>
                <TH className="w-36">Created</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors"
                >
                  <TD>
                    <span className="font-mono text-xs text-[#666] whitespace-nowrap">{row.job_id ?? '—'}</span>
                  </TD>
                  <TD>
                    <span
                      onClick={(e) => { e.stopPropagation(); onSelect(row.id) }}
                      className="font-medium text-[#0F0F12] block truncate max-w-[220px] cursor-pointer hover:text-[#5E6AD2] hover:underline"
                    >
                      {row.title}
                    </span>
                  </TD>
                  <TD>
                    <span className="text-[#666] block truncate max-w-[160px]">{row.client?.name ?? '—'}</span>
                  </TD>
                  <TD>
                    <span className="text-[#666] block truncate max-w-[140px]">{row.am?.name ?? '—'}</span>
                  </TD>
                  <TD><StatusBadge value={row.status} /></TD>
                  <TD><PriorityBadge value={row.priority} /></TD>
                  <TD>
                    <span className="text-[#666]">{row.num_positions ?? '—'}</span>
                  </TD>
                  <TD>
                    <span className="text-[#666]">{formatDate(row.created_at)}</span>
                  </TD>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {rows.map((row) => (
          <MandateCard key={row.id} row={row} onSelect={onSelect} />
        ))}
      </div>
    </>
  )
}

// Stacked card for phone-width screens, mirroring CandidateCard's structure
// (src/components/pipeline/CandidateCard.jsx) — kept local rather than reused
// since mandate status/priority badges are a different shape than the
// candidate stage/status badges CandidateCard hardcodes.
function MandateCard({ row, onSelect }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(row.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(row.id) } }}
      className="w-full text-left px-4 py-3 border-b border-[#F0F0F4] active:bg-[#F5F5F8] transition-colors cursor-pointer"
    >
      <p className="font-medium text-[#0F0F12] text-sm truncate">{row.title}</p>
      {row.job_id && <p className="text-xs text-[#999] font-mono mt-0.5 truncate">{row.job_id}</p>}

      <p className="text-xs text-[#666] mt-1.5 truncate">
        {[row.client?.name, row.am?.name ? `AM: ${row.am.name}` : null].filter(Boolean).join(' · ') || '—'}
      </p>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <StatusBadge value={row.status} />
        <PriorityBadge value={row.priority} />
      </div>

      <div className="mt-2 space-y-0.5">
        <p className="text-xs text-[#999]">Positions: {row.num_positions ?? '—'}</p>
        <p className="text-xs text-[#999]">Created {formatDate(row.created_at)}</p>
      </div>
    </div>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function MandateList() {
  const navigate = useNavigate()
  const [refreshToken] = useState(0)
  const { rows, loading, error } = useMandatesData(refreshToken)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const [page, setPage] = useState(1)

  const hasFilters = !!(search || statusFilter || priorityFilter)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter((r) => {
      if (q && !r.title?.toLowerCase().includes(q)) return false
      if (statusFilter && r.status !== statusFilter) return false
      if (priorityFilter && r.priority !== priorityFilter) return false
      return true
    })
  }, [rows, search, statusFilter, priorityFilter])

  useEffect(() => { setPage(1) }, [search, statusFilter, priorityFilter])

  const paginated = useMemo(
    () => filtered.slice((page - 1) * 50, page * 50),
    [filtered, page]
  )

  return (
    <AppShell title="Mandates">
      <div className="flex flex-col h-full">

        {/* Filter bar — desktop */}
        <div className="hidden md:flex px-6 py-3 border-b border-[#F0F0F4] bg-white items-center gap-3 flex-wrap shrink-0">
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
              placeholder="Search mandates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-52"
            />
          </div>

          <SelectFilter value={statusFilter} onChange={setStatusFilter} placeholder="All statuses">
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </SelectFilter>

          <SelectFilter value={priorityFilter} onChange={setPriorityFilter} placeholder="All priorities">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </SelectFilter>

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter('') }}
              className="text-xs text-[#5E6AD2] hover:underline ml-1"
            >
              Clear filters
            </button>
          )}

          <span className="text-xs text-[#999] ml-auto">
            {loading ? '…' : `${filtered.length} mandate${filtered.length !== 1 ? 's' : ''}`}
          </span>

          {/* Add Mandate button */}
          <button
            onClick={() => navigate('/mandates/new')}
            className="h-8 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 flex items-center gap-1.5"
            style={{ backgroundColor: '#5E6AD2' }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            Add Mandate
          </button>
        </div>

        {/* Filter bar — mobile */}
        <div className="md:hidden border-b border-[#F0F0F4] bg-white shrink-0">
          {/* Search + Add */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none"
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
              >
                <circle cx="6.5" cy="6.5" r="4.5" />
                <path d="M10.5 10.5l3 3" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search mandates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-full"
              />
            </div>
            <button
              onClick={() => navigate('/mandates/new')}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 flex items-center gap-1.5 shrink-0"
              style={{ backgroundColor: '#5E6AD2' }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              Add
            </button>
          </div>

          {/* Filter pills — horizontally scrollable */}
          <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto">
            <FilterPill
              title="Status"
              value={statusFilter}
              onSelect={setStatusFilter}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'on_hold', label: 'On Hold' },
                { value: 'closed', label: 'Closed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
            <FilterPill
              title="Priority"
              value={priorityFilter}
              onSelect={setPriorityFilter}
              options={[
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </div>

          {/* Clear filters + count */}
          <div className="flex items-center px-4 pb-2">
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter('') }}
                className="text-xs text-[#5E6AD2] hover:underline"
              >
                Clear filters
              </button>
            )}
            <span className="text-xs text-[#999] ml-auto">
              {loading ? '…' : `${filtered.length} mandate${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            Failed to load mandates: {error}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <MandatesTable
            rows={paginated}
            loading={loading}
            onSelect={(id) => navigate(`/mandates/${id}`)}
            hasFilters={hasFilters}
          />
        </div>
        {!loading && filtered.length > 0 && (
          <Pagination total={filtered.length} page={page} onChange={setPage} />
        )}
      </div>
    </AppShell>
  )
}
