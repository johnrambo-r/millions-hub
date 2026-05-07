import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import ClientPanel from '../components/ClientPanel'
import AddClientForm from '../components/AddClientForm'
import { useClientsData } from '../hooks/useClientsData'
import useRole from '../hooks/useRole'

// ─── badges ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  'Active':   'bg-green-50 text-green-700',
  'On Hold':  'bg-amber-50 text-amber-700',
  'Inactive': 'bg-gray-100 text-gray-500',
}

const TYPE_STYLES = {
  'GCC':             'bg-blue-50 text-blue-700',
  'Product Startup': 'bg-purple-50 text-purple-700',
  'IT Services':     'bg-indigo-50 text-indigo-700',
  'Consulting':      'bg-orange-50 text-orange-700',
}

export function AccountStatusBadge({ value }) {
  if (!value) return <span className="text-sm text-[#999]">—</span>
  const cls = STATUS_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {value}
    </span>
  )
}

export function ClientTypeBadge({ value }) {
  if (!value) return <span className="text-sm text-[#999]">—</span>
  const cls = TYPE_STYLES[value] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {value}
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

// ─── table ─────────────────────────────────────────────────────────────────

const TH = ({ children, className = '' }) => (
  <th className={`px-4 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap ${className}`}>
    {children}
  </th>
)

const TD = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
)

function ClientsTable({ rows, loading, onSelect }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#999]">
        Loading clients…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#999]">
        No clients match the current filters
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
            <TH>Name</TH>
            <TH>Industry</TH>
            <TH className="w-40">Client Type</TH>
            <TH>Location</TH>
            <TH className="w-32">Status</TH>
            <TH>Primary Contact</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
            >
              <TD>
                <span className="font-medium text-[#0F0F12] block truncate max-w-[180px]">
                  {row.name}
                </span>
              </TD>
              <TD>
                <span className="text-[#666] block truncate max-w-[140px]">{row.industry ?? '—'}</span>
              </TD>
              <TD><ClientTypeBadge value={row.client_type} /></TD>
              <TD>
                <span className="text-[#666] block truncate max-w-[140px]">{row.location ?? '—'}</span>
              </TD>
              <TD><AccountStatusBadge value={row.account_status} /></TD>
              <TD>
                <span className="text-[#666] block truncate max-w-[160px]">{row.primary_contact_name ?? '—'}</span>
              </TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────

const ACCOUNT_STATUSES = ['Active', 'On Hold', 'Inactive']
const CLIENT_TYPES = ['GCC', 'Product Startup', 'IT Services', 'Consulting']

export default function Clients() {
  const { isRecruiter, loading: roleLoading } = useRole()
  const [refreshToken, setRefreshToken] = useState(0)
  const { rows, loading, error } = useClientsData(refreshToken)

  if (roleLoading) return null
  if (isRecruiter) return <Navigate to="/dashboard" replace />

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter((r) => {
      if (q && !r.name?.toLowerCase().includes(q)) return false
      if (statusFilter && r.account_status !== statusFilter) return false
      if (typeFilter && r.client_type !== typeFilter) return false
      return true
    })
  }, [rows, search, statusFilter, typeFilter])

  function handleAdded(newClient) {
    setShowAddForm(false)
    setRefreshToken((t) => t + 1)
    setSelectedClient(newClient)
  }

  return (
    <AppShell title="Clients">
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
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-52"
            />
          </div>

          <SelectFilter value={statusFilter} onChange={setStatusFilter} placeholder="All statuses">
            {ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectFilter>

          <SelectFilter value={typeFilter} onChange={setTypeFilter} placeholder="All types">
            {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </SelectFilter>

          {(search || statusFilter || typeFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter('') }}
              className="text-xs text-[#5E6AD2] hover:underline ml-1"
            >
              Clear filters
            </button>
          )}

          <span className="text-xs text-[#999] ml-auto">
            {loading ? '…' : `${filtered.length} client${filtered.length !== 1 ? 's' : ''}`}
          </span>

          {/* Add Client button */}
          <button
            onClick={() => setShowAddForm(true)}
            className="h-8 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 flex items-center gap-1.5"
            style={{ backgroundColor: '#5E6AD2' }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            Add Client
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            Failed to load clients: {error}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <ClientsTable
            rows={filtered}
            loading={loading}
            onSelect={setSelectedClient}
          />
        </div>
      </div>

      {/* Detail panel */}
      <ClientPanel
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onUpdate={(updated) => {
          setSelectedClient((prev) => prev ? { ...prev, ...updated } : prev)
          setRefreshToken((t) => t + 1)
        }}
      />

      {/* Add client modal */}
      {showAddForm && (
        <AddClientForm
          onClose={() => setShowAddForm(false)}
          onAdded={handleAdded}
        />
      )}
    </AppShell>
  )
}
