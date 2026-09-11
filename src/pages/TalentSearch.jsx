import { useState } from 'react'
import AppShell from '../components/layout/AppShell'
import CandidateSearchBar from '../components/pipeline/CandidateSearchBar'
import CandidateCard from '../components/pipeline/CandidateCard'
import CandidatePanel from '../components/pipeline/CandidatePanel'
import useCandidateSearch from '../hooks/useCandidateSearch'
import { supabase } from '../lib/supabase'
import { CANDIDATE_FIELDS } from './Pipeline'

// Dedicated home for natural-language resume search — relocated from an inline bar on the
// Candidates screen (Pipeline.jsx) to its own nav entry, since it's a distinct discovery tool
// ("find candidates by skills/experience I'm describing") rather than a filter over a list the
// recruiter is already browsing. Same functionality as before, just a new home: no new features
// (filters, saved searches, etc. are later phases).

function EmptyPrompt() {
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

function LoadingState() {
  return <p className="text-sm text-[#999] text-center py-16">Searching…</p>
}

function EmptyState({ message }) {
  return <p className="text-sm text-[#999] text-center py-16">{message}</p>
}

function SearchResults({ results, loading, error, onSelect }) {
  if (loading) return <LoadingState />
  if (error) return <EmptyState message={error} />
  if (results.length === 0) return <EmptyState message="No matching candidates found" />

  return (
    <div className="max-w-2xl mx-auto">
      {results.map((r) => (
        <CandidateCard
          key={r.id}
          onClick={() => onSelect(r.id)}
          name={r.name}
          meta={[r.skill_role, r.current_company].filter(Boolean).join(' · ') || undefined}
          detailLines={[
            r.current_location,
            r.total_exp != null ? `${r.total_exp} yrs experience` : null,
            r.phone,
            `${Math.round(r.similarity * 100)}% match`,
          ].filter(Boolean)}
        />
      ))}
    </div>
  )
}

export default function TalentSearch() {
  const [query, setQuery] = useState('')
  const { results, loading, error } = useCandidateSearch(query)

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [pendingSelect, setPendingSelect] = useState(null)

  function handleSelect(candidate) {
    if (!selectedCandidate) {
      setSelectedCandidate(candidate)
    } else if (selectedCandidate.id !== candidate.id) {
      setPendingSelect(candidate)
    }
  }

  // Search results only carry the reduced field set search_candidates_by_embedding returns, not
  // the full CANDIDATE_FIELDS shape CandidatePanel expects to seed its edit form — fetch the full
  // row before opening the panel, same pattern Pipeline.jsx uses for cross-page navigation.
  async function handleResultClick(id) {
    const { data } = await supabase.from('candidates').select(CANDIDATE_FIELDS).eq('id', id).single()
    if (data) handleSelect(data)
  }

  return (
    <AppShell title="Talent Search">
      <div className="flex flex-col h-full">
        <CandidateSearchBar
          value={query}
          onChange={setQuery}
          loading={loading}
          error={error}
          resultCount={results.length}
        />

        <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
          {query.trim() ? (
            <SearchResults results={results} loading={loading} error={error} onSelect={handleResultClick} />
          ) : (
            <EmptyPrompt />
          )}
        </div>
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
