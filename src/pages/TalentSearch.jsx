import { useState } from 'react'
import AppShell from '../components/layout/AppShell'
import CandidateSearchBar from '../components/pipeline/CandidateSearchBar'
import AdvancedSearchFilters from '../components/pipeline/AdvancedSearchFilters'
import SearchResultCard from '../components/pipeline/SearchResultCard'
import CandidatePanel from '../components/pipeline/CandidatePanel'
import Pagination from '../components/Pagination'
import useCandidateSearch from '../hooks/useCandidateSearch'
import useCandidateFilterSearch from '../hooks/useCandidateFilterSearch'
import { supabase } from '../lib/supabase'
import { CANDIDATE_FIELDS } from './Pipeline'

// Two search modes on one page: Advanced Search (keyword + structured filters, Postgres
// full-text search — genuinely filterable, opens first by default) and Smart Search (semantic/
// conceptual, pgvector — ranks by similarity, doesn't filter). Kept as tabs on the same page
// rather than two nav entries since they're both "find a candidate," just two different tools
// for it; selection/CandidatePanel state is shared across both so switching tabs doesn't lose
// or duplicate an open panel.

const TABS = [
  { id: 'advanced', label: 'Advanced Search' },
  { id: 'smart', label: 'Smart Search' },
]

function LoadingState() {
  return <p className="text-sm text-[#999] text-center py-16">Searching…</p>
}

function EmptyState({ message }) {
  return <p className="text-sm text-[#999] text-center py-16">{message}</p>
}

// Responsive result grid: 1 col mobile, 2 cols narrow window/small laptop (≥768px), 3 cols
// standard desktop/laptop (≥1280px), 4 cols wide desktop (≥1600px) — per build brief.
const RESULTS_GRID = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-4'

// ─── Smart Search (unchanged behavior, just extracted into its own tab component) ────────────

function SmartSearchEmptyPrompt() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-[#5E6AD2] mb-3">
        <path d="M10 2c.7 3.6 2.5 5.4 6 6-3.5.6-5.3 2.4-6 6-.7-3.6-2.5-5.4-6-6 3.5-.6 5.3-2.4 6-6z" />
      </svg>
      <p className="text-sm font-medium text-[#0F0F12]">Search candidates by skills, experience, or background</p>
      <p className="text-xs text-[#999] mt-1 max-w-sm">
        Try something like "senior React developer with fintech experience" or "GCP data engineer"
      </p>
    </div>
  )
}

function SmartSearchResults({ results, loading, error, onSelect }) {
  if (loading) return <LoadingState />
  if (error) return <EmptyState message={error} />
  if (results.length === 0) return <EmptyState message="No matching candidates found" />

  return (
    <div className={RESULTS_GRID}>
      {results.map((r) => (
        <SearchResultCard
          key={r.id}
          onClick={() => onSelect(r.id)}
          name={r.name}
          skillRole={r.skill_role}
          location={r.current_location}
          experience={r.total_exp}
          email={r.email}
          phone={r.phone}
          matchPercent={r.similarity}
        />
      ))}
    </div>
  )
}

function SmartSearchTab({ onSelect }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { results, total, loading, error, pageSize } = useCandidateSearch(query, page)

  function handleQueryChange(value) {
    setQuery(value)
    setPage(1)
  }

  return (
    <>
      <CandidateSearchBar
        value={query}
        onChange={handleQueryChange}
        loading={loading}
        error={error}
        resultCount={total}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {query.trim() ? (
          <SmartSearchResults results={results} loading={loading} error={error} onSelect={onSelect} />
        ) : (
          <SmartSearchEmptyPrompt />
        )}
      </div>
      {query.trim() && !loading && total > 0 && (
        <Pagination total={total} page={page} perPage={pageSize} onChange={setPage} />
      )}
    </>
  )
}

// ─── Advanced Search ────────────────────────────────────────────────────────────────────────

const INITIAL_FILTERS = {
  keyword: '', expMin: '', expMax: '', location: '', company: '', education: '',
  addedAfter: '', addedBefore: '',
}

function AdvancedSearchResults({ results, loading, error, onSelect }) {
  if (loading) return <LoadingState />
  if (error) return <EmptyState message={error} />
  if (results.length === 0) return <EmptyState message="No matching candidates found" />

  return (
    <div className={RESULTS_GRID}>
      {results.map((r) => (
        <SearchResultCard
          key={r.id}
          onClick={() => onSelect(r.id)}
          name={r.name}
          skillRole={r.skill_role}
          location={r.current_location}
          experience={r.total_exp}
          email={r.email}
          phone={r.phone}
        />
      ))}
    </div>
  )
}

function AdvancedSearchTab({ onSelect }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [page, setPage] = useState(1)
  const { results, total, loading, error, hasAnyFilter, pageSize } = useCandidateFilterSearch(filters, page)

  function handleFilterChange(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }

  return (
    <>
      <AdvancedSearchFilters filters={filters} onChange={handleFilterChange} />
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {hasAnyFilter ? (
          <AdvancedSearchResults results={results} loading={loading} error={error} onSelect={onSelect} />
        ) : (
          <EmptyState message="Enter a keyword or filter to search candidates" />
        )}
      </div>
      {hasAnyFilter && !loading && total > 0 && (
        <Pagination total={total} page={page} perPage={pageSize} onChange={setPage} />
      )}
    </>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────────────────────

export default function TalentSearch() {
  const [activeTab, setActiveTab] = useState('advanced')

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [pendingSelect, setPendingSelect] = useState(null)

  function handleSelect(candidate) {
    if (!selectedCandidate) {
      setSelectedCandidate(candidate)
    } else if (selectedCandidate.id !== candidate.id) {
      setPendingSelect(candidate)
    }
  }

  // Both tabs' results carry a reduced field set, not the full CANDIDATE_FIELDS shape
  // CandidatePanel expects to seed its edit form — fetch the full row before opening the panel,
  // same pattern Pipeline.jsx uses for cross-page navigation.
  async function handleResultClick(id) {
    const { data } = await supabase.from('candidates').select(CANDIDATE_FIELDS).eq('id', id).single()
    if (data) handleSelect(data)
  }

  return (
    <AppShell title="Talent Search">
      <div className="flex flex-col h-full">
        <div className="px-4 sm:px-6 border-b border-[#F0F0F4] bg-white flex items-center gap-1 shrink-0 overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-[#5E6AD2] text-[#5E6AD2]'
                  : 'border-transparent text-[#999] hover:text-[#666]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'advanced' ? (
          <AdvancedSearchTab onSelect={handleResultClick} />
        ) : (
          <SmartSearchTab onSelect={handleResultClick} />
        )}
      </div>

      <CandidatePanel
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onUpdate={() => setSelectedCandidate(null)}
        pendingSelect={pendingSelect}
        onPendingResolved={(candidate) => {
          setSelectedCandidate(candidate)
          setPendingSelect(null)
        }}
        onPendingCancelled={() => setPendingSelect(null)}
      />
    </AppShell>
  )
}
