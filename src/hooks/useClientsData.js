import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useClientsData(refreshToken = 0) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRows(data ?? [])
        setLoading(false)
      })
  }, [refreshToken])

  return { rows, loading, error }
}
