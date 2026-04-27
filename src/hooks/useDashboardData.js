import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DEAD_STATUSES = [
  'Internal Reject',
  'Internal Duplicate',
  'Reject',
  'Offer Declined',
  'Offer Revoked',
  'Dropped Out',
  'Joining & Dropped',
]

const L2_PLUS_STAGES = ['L2', 'L3', 'Client Onsite', 'HR', 'Offer', 'Joining']
const CV_STAGES = ['CV']
const INTERVIEW_STAGES = ['L1', 'HR']

// Returns "YYYY-MM-DD" in local time — matches how Supabase date columns are stored
function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysSince(dateStr) {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86400000)
}

export function useDashboardData(profile) {
  const { session } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) {
      console.log('[useDashboardData] waiting for profile…')
      return
    }

    console.log('[useDashboardData] fetching — profile:', profile)

    async function fetchData() {
      setLoading(true)

      // Select only columns that actually exist; omit stage_updated_at in favour
      // of status_changed_at (the real column name confirmed by the user).
      let query = supabase
        .from('candidates')
        .select('id, name, skill_role, stage, status, interview_date, status_changed_at, total_exp, relevant_exp, recruiter_id, clients(name), profiles(name)')

      // Recruiters see only their own candidates; managers see all.
      if (profile.role === 'recruiter') {
        query = query.eq('recruiter_id', session.user.id)
      }

      const { data: rows, error } = await query

      console.log('[useDashboardData] raw response →', { rows, error })

      if (error) {
        console.error('[useDashboardData] Supabase error:', error.message, error.details, error.hint)
        setLoading(false)
        return
      }

      if (!rows || rows.length === 0) {
        console.warn('[useDashboardData] query returned no rows — check RLS policies on the candidates table')
        setData({ interviewsToday: [], cvFeedbackOverdue: [], interviewFeedbackOverdue: [], liveL2Plus: [] })
        setLoading(false)
        return
      }

      const todayStr = localDateStr()
      console.log('[useDashboardData] todayStr:', todayStr, '| total rows:', rows.length)

      const interviewsToday = rows.filter(
        // interview_date from Supabase is "YYYY-MM-DD" — compare as strings, no timezone conversion needed
        (r) => r.interview_date?.slice(0, 10) === todayStr
      )

      const cvFeedbackOverdue = rows
        .filter(
          (r) =>
            CV_STAGES.includes(r.stage) &&
            r.status === 'FB Pending' &&
            daysSince(r.status_changed_at) >= 3
        )
        .map((r) => ({ ...r, daysOverdue: daysSince(r.status_changed_at) }))

      const interviewFeedbackOverdue = rows
        .filter(
          (r) =>
            INTERVIEW_STAGES.includes(r.stage) &&
            r.status === 'FB Pending' &&
            daysSince(r.status_changed_at) >= 3
        )
        .map((r) => ({ ...r, daysOverdue: daysSince(r.status_changed_at) }))

      const liveL2Plus = rows.filter(
        (r) => L2_PLUS_STAGES.includes(r.stage) && !DEAD_STATUSES.includes(r.status)
      )

      console.log('[useDashboardData] computed →', {
        interviewsToday: interviewsToday.length,
        cvFeedbackOverdue: cvFeedbackOverdue.length,
        interviewFeedbackOverdue: interviewFeedbackOverdue.length,
        liveL2Plus: liveL2Plus.length,
      })

      setData({ interviewsToday, cvFeedbackOverdue, interviewFeedbackOverdue, liveL2Plus })
      setLoading(false)
    }

    fetchData()
  }, [profile, session])

  return { data, loading }
}
