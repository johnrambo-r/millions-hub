import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useNextCandidateId() {
  const [candidateId, setCandidateId] = useState('')

  const generate = useCallback(async () => {
    const { data, error } = await supabase.rpc('next_candidate_id')
    if (!error && data) {
      setCandidateId(data)
    }
  }, [])

  useEffect(() => { generate() }, [generate])

  return { candidateId, regenerate: generate }
}
