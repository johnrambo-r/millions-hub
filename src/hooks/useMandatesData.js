import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useMandatesData(refreshToken = 0) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    supabase
      .from('mandates')
      .select('*, client:clients!client_id(id, name), am:profiles!am_id(id, name)')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRows(data ?? [])
        setLoading(false)
      })
  }, [refreshToken])

  return { rows, loading, error }
}
