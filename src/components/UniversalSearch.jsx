import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

async function runSearch(query) {
  const q = query.trim()
  if (!q) return null

  const [directRes, mcRes, mandatesRes, clientsRes] = await Promise.all([
    supabase
      .from('candidates')
      .select('id, name, email, phone')
      .or(
        `name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,id.ilike.%${q}%,comments.ilike.%${q}%`,
      ),
    supabase
      .from('mandate_candidates')
      .select('candidate_id')
      .ilike('applicant_id', `%${q}%`),
    supabase
      .from('mandates')
      .select('id, title, job_id, client:clients!client_id(id, name)')
      .or(`title.ilike.%${q}%,job_id.ilike.%${q}%`),
    supabase.from('clients').select('id, name').ilike('name', `%${q}%`),
  ])

  const direct = directRes.data ?? []
  const directIds = new Set(direct.map((c) => c.id))
  const extraIds = [
    ...new Set((mcRes.data ?? []).map((r) => r.candidate_id)),
  ].filter((id) => !directIds.has(id))

  let extra = []
  if (extraIds.length > 0) {
    const { data } = await supabase
      .from('candidates')
      .select('id, name, email, phone')
      .in('id', extraIds)
    extra = data ?? []
  }

  const allCandidates = [...direct, ...extra]
  const allMandates = mandatesRes.data ?? []
  const allClients = clientsRes.data ?? []

  return {
    candidates: { rows: allCandidates.slice(0, 5), total: allCandidates.length },
    mandates: { rows: allMandates.slice(0, 5), total: allMandates.length },
    clients: { rows: allClients.slice(0, 5), total: allClients.length },
  }
}

function ResultRow({ onClick, primary, secondary }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex flex-col items-start px-3 py-2 rounded-lg text-left hover:bg-[#F5F5F8] transition-colors"
    >
      <span className="text-sm font-medium text-[#0F0F12] leading-snug">{primary}</span>
      {secondary && (
        <span className="text-xs text-[#888] mt-0.5 leading-snug">{secondary}</span>
      )}
    </button>
  )
}

function SeeAllLink({ count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 text-xs font-medium text-[#5E6AD2] hover:underline px-3 py-1"
    >
      See all {count} results →
    </button>
  )
}

function GroupHeader({ label }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">
      {label}
    </p>
  )
}

export default function UniversalSearch({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const genRef = useRef(0)

  // Reset + focus on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(null)
      return
    }
    setLoading(true)
    const gen = ++genRef.current
    const timer = setTimeout(async () => {
      try {
        const r = await runSearch(q)
        if (gen === genRef.current) setResults(r)
      } finally {
        if (gen === genRef.current) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  // Esc to close
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const hasAny =
    results &&
    (results.candidates.total > 0 ||
      results.mandates.total > 0 ||
      results.clients.total > 0)

  const noResults =
    results && !hasAny && query.trim().length > 0

  function goTo(path, opts) {
    navigate(path, opts)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden mx-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center border-b border-[#F0F0F4] px-4">
          <svg
            className="w-4 h-4 text-[#999] shrink-0"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M15 15l-3-3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidates, mandates, clients…"
            className="flex-1 h-12 ml-3 text-sm text-[#0F0F12] placeholder-[#bbb] outline-none bg-transparent"
          />
          {loading && (
            <span className="text-xs text-[#aaa] shrink-0">Searching…</span>
          )}
        </div>

        {/* Results */}
        {!query.trim() && (
          <p className="px-4 py-5 text-sm text-[#bbb] text-center">
            Start typing to search
          </p>
        )}

        {noResults && (
          <p className="px-4 py-5 text-sm text-[#888] text-center">
            No results found
          </p>
        )}

        {hasAny && (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {/* Candidates */}
            {results.candidates.total > 0 && (
              <div>
                <GroupHeader label="Candidates" />
                {results.candidates.rows.map((c) => (
                  <ResultRow
                    key={c.id}
                    primary={c.name || c.id}
                    secondary={c.email || c.phone}
                    onClick={() =>
                      goTo('/pipeline', { state: { openCandidateId: c.id } })
                    }
                  />
                ))}
                {results.candidates.total > 5 && (
                  <SeeAllLink
                    count={results.candidates.total}
                    onClick={() => goTo('/pipeline')}
                  />
                )}
              </div>
            )}

            {/* Mandates */}
            {results.mandates.total > 0 && (
              <div>
                <GroupHeader label="Mandates" />
                {results.mandates.rows.map((m) => (
                  <ResultRow
                    key={m.id}
                    primary={m.title}
                    secondary={
                      [m.client?.name, m.job_id].filter(Boolean).join(' · ') ||
                      undefined
                    }
                    onClick={() => goTo(`/mandates/${m.id}`)}
                  />
                ))}
                {results.mandates.total > 5 && (
                  <SeeAllLink
                    count={results.mandates.total}
                    onClick={() => goTo('/mandates')}
                  />
                )}
              </div>
            )}

            {/* Clients */}
            {results.clients.total > 0 && (
              <div>
                <GroupHeader label="Clients" />
                {results.clients.rows.map((cl) => (
                  <ResultRow
                    key={cl.id}
                    primary={cl.name}
                    onClick={() => goTo(`/clients/${cl.id}`)}
                  />
                ))}
                {results.clients.total > 5 && (
                  <SeeAllLink
                    count={results.clients.total}
                    onClick={() => goTo('/clients')}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
