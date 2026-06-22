import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACTIVE_STATUSES, PLACED_STATUSES } from '../lib/candidateConstants'

const DAY_MS = 86400000
const STAGE_ORDER = ['CV', 'L1', 'L2', 'L3', 'Client Onsite', 'HR', 'Offer', 'Joining']
const INTERVIEW_STAGES = ['L1', 'L2', 'L3', 'Client Onsite', 'HR']
const PIPELINE_STAGES = ['L2', 'L3', 'Client Onsite', 'HR']
const AT_RISK_DAYS = 14

const MC_KPI_SELECT = `
  id, candidate_id, mandate_id, stage, status, status_changed_at, linked_at,
  billing_value_approx, billing_value_final, linked_by,
  candidate:candidates(id, name),
  linked_by_profile:profiles!linked_by(id, name),
  mandate:mandates!mandate_id(id, title, job_id, status, client_id, am_id,
    client:clients!client_id(id, name),
    am:profiles!am_id(id, name)
  )
`

function getPeriodStart(period) {
  const now = new Date()
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  if (period === 'year') return new Date(now.getFullYear(), 0, 1)
  return null
}

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / DAY_MS)
}

export function useKpiData({ period, role, userId }) {
  const [state, setState] = useState({ loading: true, error: null, data: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const periodStart = getPeriodStart(period)

      let mcQuery = supabase.from('mandate_candidates').select(MC_KPI_SELECT)
      if (periodStart) mcQuery = mcQuery.gte('status_changed_at', periodStart.toISOString())

      const [mcRes, mandatesRes, profilesRes] = await Promise.all([
        mcQuery,
        supabase
          .from('mandates')
          .select('id, title, job_id, status, created_at, client_id, am_id, client:clients!client_id(id, name), am:profiles!am_id(id, name)')
          .eq('status', 'active'),
        supabase.from('profiles').select('id, name, role').eq('active', true).order('name'),
      ])

      if (mcRes.error) throw mcRes.error
      if (mandatesRes.error) throw mandatesRes.error
      if (profilesRes.error) throw profilesRes.error

      let mcs = mcRes.data ?? []
      let mandates = mandatesRes.data ?? []

      if (role === 'recruiter') {
        mcs = mcs.filter((mc) => mc.linked_by === userId)
      } else if (role === 'account_manager') {
        mcs = mcs.filter((mc) => mc.mandate?.am_id === userId)
        mandates = mandates.filter((m) => m.am_id === userId)
      }

      // Headline metrics
      const activeMandates = mandates.length
      const totalInPipeline = mcs.filter(
        (mc) => PIPELINE_STAGES.includes(mc.stage) && ACTIVE_STATUSES.includes(mc.status)
      ).length
      const interviewsThisPeriod = mcs.filter((mc) => INTERVIEW_STAGES.includes(mc.stage)).length
      const offersThisPeriod = mcs.filter((mc) => mc.stage === 'Offer').length
      const placementsThisPeriod = mcs.filter((mc) => PLACED_STATUSES.includes(mc.status)).length
      const scoresValue = mcs.reduce(
        (sum, mc) => (mc.status !== 'Invoice Raised' ? sum + Number(mc.billing_value_approx || 0) : sum), 0
      )
      const irValue = mcs.reduce(
        (sum, mc) => (mc.status === 'Invoice Raised' ? sum + Number(mc.billing_value_approx || 0) : sum), 0
      )

      // Per-recruiter stats
      const recruiterMap = new Map()
      for (const mc of mcs) {
        const rid = mc.linked_by
        if (!rid) continue
        if (!recruiterMap.has(rid)) {
          recruiterMap.set(rid, {
            id: rid, name: mc.linked_by_profile?.name ?? '—',
            cvsSent: 0, interviews: 0, offers: 0, placements: 0, irValue: 0,
          })
        }
        const r = recruiterMap.get(rid)
        r.cvsSent++
        if (STAGE_ORDER.indexOf(mc.stage) >= STAGE_ORDER.indexOf('L1')) r.interviews++
        if (mc.stage === 'Offer') r.offers++
        if (PLACED_STATUSES.includes(mc.status)) r.placements++
        if (mc.status === 'Invoice Raised') r.irValue += Number(mc.billing_value_approx || 0)
      }
      let recruiterStats = Array.from(recruiterMap.values())
      if (role === 'recruiter') recruiterStats = recruiterStats.filter((r) => r.id === userId)
      recruiterStats.sort((a, b) => b.placements - a.placements)

      // Revenue by client
      const clientMap = new Map()
      for (const mc of mcs) {
        const client = mc.mandate?.client
        if (!client) continue
        if (!clientMap.has(client.id)) {
          clientMap.set(client.id, { clientId: client.id, clientName: client.name, scores: 0, ir: 0, placements: 0 })
        }
        const c = clientMap.get(client.id)
        if (mc.status === 'Invoice Raised') c.ir += Number(mc.billing_value_approx || 0)
        else c.scores += Number(mc.billing_value_approx || 0)
        if (PLACED_STATUSES.includes(mc.status)) c.placements++
      }
      const revenueByClient = Array.from(clientMap.values()).sort((a, b) => b.ir - a.ir)

      // At-risk mandates: no mc activity in the last 14 days
      const latestActivityByMandate = new Map()
      for (const mc of mcs) {
        if (!mc.mandate_id || !mc.status_changed_at) continue
        const cur = latestActivityByMandate.get(mc.mandate_id)
        if (!cur || new Date(mc.status_changed_at) > new Date(cur)) {
          latestActivityByMandate.set(mc.mandate_id, mc.status_changed_at)
        }
      }
      const atRiskMandates = mandates
        .map((m) => {
          const latest = latestActivityByMandate.get(m.id) ?? m.created_at
          return {
            id: m.id, title: m.title, job_id: m.job_id,
            clientName: m.client?.name ?? '—', amName: m.am?.name ?? '—',
            daysSinceActivity: daysSince(latest),
          }
        })
        .filter((m) => m.daysSinceActivity != null && m.daysSinceActivity >= AT_RISK_DAYS)
        .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)

      // At-risk candidates: stuck in the same stage for 14+ days
      const atRiskCandidates = mcs
        .filter((mc) => ACTIVE_STATUSES.includes(mc.status))
        .map((mc) => ({
          mcId: mc.id,
          candidateName: mc.candidate?.name ?? '—',
          mandateTitle: mc.mandate?.title ?? '—',
          clientName: mc.mandate?.client?.name ?? '—',
          stage: mc.stage,
          daysInStage: daysSince(mc.status_changed_at),
        }))
        .filter((c) => c.daysInStage != null && c.daysInStage >= AT_RISK_DAYS)
        .sort((a, b) => b.daysInStage - a.daysInStage)

      setState({
        loading: false,
        error: null,
        data: {
          activeMandates, totalInPipeline, interviewsThisPeriod, offersThisPeriod,
          placementsThisPeriod, scoresValue, irValue,
          recruiterStats, revenueByClient,
          atRiskMandates, atRiskCandidates,
        },
      })
    } catch (error) {
      setState({ loading: false, error, data: null })
    }
  }, [period, role, userId])

  useEffect(() => { load() }, [load])

  return { ...(state.data ?? {}), loading: state.loading, error: state.error }
}

export default useKpiData
