import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useNextCandidateId() {
  const [candidateId, setCandidateId] = useState('')

  const generate = useCallback(async () => {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from('candidates')
      .select('id')
      .like('id', `MA-${year}-%`)
      .order('id', { ascending: false })
      .limit(1)

    let seq = 1
    if (data && data.length > 0) {
      const parts = data[0].id.split('-')
      const n = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(n)) seq = n + 1
    }
    setCandidateId(`MA-${year}-${String(seq).padStart(4, '0')}`)
  }, [])

  useEffect(() => { generate() }, [generate])

  return { candidateId, regenerate: generate }
}
