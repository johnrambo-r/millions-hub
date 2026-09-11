import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 250

// Debounced natural-language candidate search, calling the search-candidates Edge Function
// (embeds the query via OpenAI, then ranks candidates via search_candidates_by_embedding — see
// supabase/functions/search-candidates/index.ts). Mirrors UniversalSearch.jsx's debounce +
// generation-counter guard against out-of-order responses (src/components/UniversalSearch.jsx:104-121).
export default function useCandidateSearch(query) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const genRef = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const gen = ++genRef.current

    const timer = setTimeout(async () => {
      const { data, error: invokeError } = await supabase.functions.invoke('search-candidates', {
        body: { query: q },
      })
      if (gen !== genRef.current) return // superseded by a newer query

      if (invokeError) {
        setError(invokeError.message || 'Search failed')
        setResults([])
      } else {
        setError(null)
        setResults(data?.results ?? [])
      }
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  return { results, loading, error }
}
