import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 250
const PAGE_SIZE = 20

// Advanced Search: keyword + structured filters via search_candidates_by_filters (Postgres
// full-text search over resume_text_tsv, no OpenAI call — see
// supabase/migrations/20260911060000_search_candidates_by_filters.sql). Calls the RPC directly
// through supabase-js (PostgREST), not an Edge Function — there's no external API to call
// server-side here, and this avoids the CORS class of bug hit building Smart Search.
//
// One uniform debounce across the whole filters+page object, not just the keyword field: exp
// min/max, location, and company are also free-text/number inputs a recruiter types into, so
// they need the same keystroke-level debounce keyword does — only education (dropdown) and the
// date range are truly discrete, and debouncing those too is imperceptible (250ms on a click).
// Mirrors useCandidateSearch.js's generation-counter guard against out-of-order responses.
export default function useCandidateFilterSearch(filters, page) {
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const genRef = useRef(0)

  const hasAnyFilter =
    filters.keyword.trim() || filters.expMin !== '' || filters.expMax !== '' ||
    filters.location.trim() || filters.company.trim() || filters.education ||
    filters.addedAfter || filters.addedBefore

  useEffect(() => {
    setLoading(true)
    const gen = ++genRef.current

    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('search_candidates_by_filters', {
        p_keyword: filters.keyword.trim() || null,
        p_exp_min: filters.expMin !== '' ? Number(filters.expMin) : null,
        p_exp_max: filters.expMax !== '' ? Number(filters.expMax) : null,
        p_location: filters.location.trim() || null,
        p_company: filters.company.trim() || null,
        p_education: filters.education || null,
        p_added_after: filters.addedAfter || null,
        p_added_before: filters.addedBefore || null,
        p_page_num: page,
        p_page_size: PAGE_SIZE,
      })
      if (gen !== genRef.current) return // superseded by a newer query

      if (rpcError) {
        setError(rpcError.message || 'Search failed')
        setResults([])
        setTotal(0)
      } else {
        setError(null)
        setResults(data ?? [])
        setTotal(data?.[0]?.total_count ?? 0)
      }
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    filters.keyword, filters.expMin, filters.expMax, filters.location,
    filters.company, filters.education, filters.addedAfter, filters.addedBefore, page,
  ])

  return { results, total, loading, error, hasAnyFilter, pageSize: PAGE_SIZE }
}
