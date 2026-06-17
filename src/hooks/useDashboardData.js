import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DEAD_STATUSES = new Set([
  'Internal Reject', 'Internal Duplicate', 'Reject',
  'Hold — Closed', 'No Response — Closed', 'No Show — Closed',
  'Offer Declined', 'Offer Revoked',
  'Declined', 'Joined & Dropped',
])

const L2_PLUS_STAGES    = ['L2', 'L3', 'Client Onsite', 'HR', 'Offer', 'Joining']
const CV_STAGES         = ['CV']
const INTERVIEW_STAGES  = ['L1', 'L2', 'L3', 'Client Onsite', 'HR']

function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysSince(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

const MC_DASHBOARD_SELECT = `
  id, stage, status, status_changed_at, interview_date,
  candidates(
    id, name, skill_role, total_exp, email, phone, alt_contact,
    current_location, preferred_location,
    education, year_of_passing,
    current_company, emp_mode, payroll_company, notice_period,
    current_ctc, expected_ctc,
    comments, resume_url,
    recruiter_id, created_at,
    profiles(id, name),
    clients(id, name)
  )
`

export function useDashboardData(profile) {
  const { session } = useAuth()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchRef              = useRef(null)

  useEffect(() => {
    if (!profile) return

    async function fetchData({ background = false } = {}) {
      if (!background) setLoading(true)

      let query = supabase
        .from('mandate_candidates')
        .select(MC_DASHBOARD_SELECT)

      if (profile.role === 'recruiter') {
        query = query.eq('linked_by', session.user.id)
      }

      const { data: mcRows, error } = await query

      if (error) {
        console.error('[useDashboardData] error:', error.message)
        setLoading(false)
        return
      }

      // Flatten each mc row into a candidate-shaped object so existing
      // Dashboard + CandidateRow components work without changes.
      const rows = (mcRows ?? [])
        .filter((mc) => mc.candidates)
        .map((mc) => ({
          ...mc.candidates,
          stage:             mc.stage,
          status:            mc.status,
          status_changed_at: mc.status_changed_at,
          interview_date:    mc.interview_date,
          _mc_id:            mc.id,
        }))

      const todayStr = localDateStr()

      const interviewsToday = rows.filter(
        (r) => r.interview_date?.slice(0, 10) === todayStr
      )

      const cvFeedbackOverdue = rows
        .filter(
          (r) =>
            CV_STAGES.includes(r.stage) &&
            r.status === 'Processed - FB Pending' &&
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
        (r) => L2_PLUS_STAGES.includes(r.stage) && !DEAD_STATUSES.has(r.status)
      )

      setData({ interviewsToday, cvFeedbackOverdue, interviewFeedbackOverdue, liveL2Plus })
      setLoading(false)
    }

    fetchRef.current = fetchData
    fetchData()

    const channel = supabase
      .channel('dashboard-mc-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mandate_candidates' },
        () => fetchRef.current?.({ background: true }))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile, session])

  return { data, loading, refresh: () => fetchRef.current?.({ background: true }) }
}
