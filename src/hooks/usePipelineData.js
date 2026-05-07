import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function usePipelineData(profile, refreshToken = 0, pipelineMode = 'my') {
  const { session } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!profile) return

    async function fetchData() {
      setLoading(true)
      setError(null)

      const userId = session.user.id

      let query = supabase
        .from('candidates')
        .select(`
          id, name, email, phone, alt_contact,
          current_location, preferred_location,
          education, year_of_passing,
          current_company, skill_role,
          total_exp, relevant_exp,
          emp_mode, payroll_company, notice_period,
          current_ctc, expected_ctc,
          interview_date, interview_time,
          comments, resume_url,
          stage, status, status_changed_at,
          recruiter_id,
          clients(id, name),
          profiles(id, name)
        `)
        .order('status_changed_at', { ascending: false })

      if (profile.role === 'recruiter') {
        query = query.eq('recruiter_id', userId)
      } else if (pipelineMode === 'my') {
        query = query.eq('recruiter_id', userId)
      } else if (pipelineMode === 'accounts') {
        const { data: clientRows } = await supabase
          .from('clients')
          .select('id')
          .eq('account_manager_id', userId)

        const clientIds = (clientRows ?? []).map((c) => c.id)
        if (clientIds.length === 0) {
          setRows([])
          setLoading(false)
          return
        }
        query = query.in('client_id', clientIds)
      }

      const { data, error } = await query

      if (error) {
        console.error('[usePipelineData] error:', error.message, error.hint)
        setError(error.message)
      } else {
        setRows(data ?? [])
      }
      setLoading(false)
    }

    fetchData()
  }, [profile, session, refreshToken, pipelineMode])

  return { rows, loading, error }
}
