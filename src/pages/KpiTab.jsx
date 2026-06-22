import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useKpiData } from '../hooks/useKpiData'

function formatMoney(val) {
  if (!val) return '₹0'
  const n = Number(val)
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000) return '₹' + Math.round(n / 1000) + 'K'
  return '₹' + n
}

const PERIODS = [
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All Time' },
]

const TH = ({ children }) => (
  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap">
    {children}
  </th>
)

const TD = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
)

function SectionHeader({ children, dot }) {
  return (
    <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3 flex items-center gap-2">
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
      {children}
    </h3>
  )
}

function DaysBadge({ days }) {
  const cls = days >= 21
    ? 'bg-red-50 text-red-600'
    : 'bg-amber-50 text-amber-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {days}d
    </span>
  )
}

function PeriodSelector({ period, setPeriod }) {
  return (
    <div className="px-6 pt-5 pb-4 flex items-center gap-1.5">
      {PERIODS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setPeriod(id)}
          className={`h-7 px-3 rounded-full text-xs font-medium transition ${
            period === id ? 'bg-[#5E6AD2] text-white' : 'bg-[#F0F0F4] text-[#666] hover:bg-[#E8E8EE]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function HeadlineStrip({ data }) {
  const tiles = [
    { label: 'Active Mandates', value: data.activeMandates, accent: '#5E6AD2' },
    { label: 'In Pipeline', value: data.totalInPipeline, accent: '#7C3AED' },
    { label: 'Interviews', value: data.interviewsThisPeriod, accent: '#B45309' },
    { label: 'Offers', value: data.offersThisPeriod, accent: '#1D8A5E' },
    { label: 'Placements', value: data.placementsThisPeriod, accent: '#16A34A' },
    { label: 'Scores', value: formatMoney(data.scoresValue), accent: '#D97706' },
    { label: 'IR', value: formatMoney(data.irValue), accent: '#059669' },
  ]
  return (
    <div className="px-6 grid grid-cols-7 gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col items-center justify-center px-3 py-4 rounded-xl border border-[#F0F0F4] bg-white">
          <span className="text-2xl font-bold leading-tight tabular-nums" style={{ color: t.accent }}>{t.value}</span>
          <span className="text-[10px] font-medium text-[#999] uppercase tracking-wider mt-0.5 text-center">{t.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Funnel Ratios ────────────────────────────────────────────────────────────

function SelectFilter({ value, onChange, placeholder, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition min-w-[130px]"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

function funnelPeriodStart(period) {
  const now = new Date()
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  if (period === 'year') return new Date(now.getFullYear(), 0, 1)
  return null
}

function fmtRatio(num, denom) {
  if (!denom || denom < 5) return '—'
  return Math.round((num / denom) * 100) + '%'
}

function RatioCard({ label, num, denom }) {
  return (
    <div className="bg-white rounded-xl border border-[#F0F0F4] p-4">
      <p className="text-xs text-[#999] mb-1.5">{label}</p>
      <p className="text-2xl font-medium text-[#0F0F12] tabular-nums mb-1">{fmtRatio(num, denom)}</p>
      <p className="text-xs text-[#999]">{num} of {denom}</p>
    </div>
  )
}

function FunnelRatiosSection() {
  const [funnelPeriod, setFunnelPeriod] = useState('month')
  const [recruiterFilter, setRecruiterFilter] = useState('')
  const [mandateFilter, setMandateFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')

  const [recruiters, setRecruiters] = useState([])
  const [mandates, setMandates] = useState([])
  const [clients, setClients] = useState([])

  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id, name').eq('active', true).order('name'),
      supabase.from('mandates').select('id, title, job_id').order('title'),
      supabase.from('clients').select('id, name').order('name'),
    ]).then(([{ data: pData }, { data: mData }, { data: cData }]) => {
      setRecruiters(pData ?? [])
      setMandates(mData ?? [])
      setClients(cData ?? [])
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const start = funnelPeriodStart(funnelPeriod)
    supabase
      .rpc('get_funnel_ratios', {
        p_recruiter_id: recruiterFilter || null,
        p_mandate_id:   mandateFilter   || null,
        p_client_id:    clientFilter    || null,
        p_period_start: start ? start.toISOString() : null,
        p_period_end:   null,
      })
      .then(({ data, error }) => {
        if (!error) setCounts(data?.[0] ?? null)
        setLoading(false)
      })
  }, [funnelPeriod, recruiterFilter, mandateFilter, clientFilter])

  const total   = counts?.total_submissions ?? 0
  const l1      = counts?.reached_l1       ?? 0
  const l2      = counts?.reached_l2       ?? 0
  const offer   = counts?.reached_offer    ?? 0
  const joining = counts?.reached_joining  ?? 0

  return (
    <div className="px-6">
      <SectionHeader>Funnel Ratios</SectionHeader>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {PERIODS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFunnelPeriod(id)}
            className={`h-7 px-3 rounded-full text-xs font-medium transition ${
              funnelPeriod === id ? 'bg-[#5E6AD2] text-white' : 'bg-[#F0F0F4] text-[#666] hover:bg-[#E8E8EE]'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="w-px h-4 bg-[#E8E8EE]" />
        <SelectFilter value={recruiterFilter} onChange={setRecruiterFilter} placeholder="All recruiters">
          {recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </SelectFilter>
        <SelectFilter value={mandateFilter} onChange={setMandateFilter} placeholder="All mandates">
          {mandates.map((m) => (
            <option key={m.id} value={m.id}>{m.title}{m.job_id ? ` · ${m.job_id}` : ''}</option>
          ))}
        </SelectFilter>
        <SelectFilter value={clientFilter} onChange={setClientFilter} placeholder="All clients">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectFilter>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[#999]">Loading…</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between px-5 py-4 rounded-xl border border-[#F0F0F4] bg-white">
            <div>
              <p className="text-xs text-[#999] mb-1">CV → Joining (end-to-end)</p>
              <p className="text-3xl font-medium text-[#0F0F12] tabular-nums">{fmtRatio(joining, total)}</p>
            </div>
            <p className="text-sm text-[#999]">{joining} of {total} submissions this period</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <RatioCard label="Submission → L1" num={l1}      denom={total} />
            <RatioCard label="L1 → L2"          num={l2}      denom={l1}    />
            <RatioCard label="L1 → Offer"        num={offer}   denom={l1}    />
            <RatioCard label="Offer → Joining"  num={joining} denom={offer} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Recruiter Performance ────────────────────────────────────────────────────

function RecruiterTable({ recruiterStats }) {
  const totals = recruiterStats.reduce(
    (acc, r) => ({
      cvsSent: acc.cvsSent + r.cvsSent,
      interviews: acc.interviews + r.interviews,
      offers: acc.offers + r.offers,
      placements: acc.placements + r.placements,
      irValue: acc.irValue + r.irValue,
    }),
    { cvsSent: 0, interviews: 0, offers: 0, placements: 0, irValue: 0 }
  )
  return (
    <div className="px-6">
      <SectionHeader>Recruiter Performance</SectionHeader>
      <div className="bg-white rounded-xl border border-[#F0F0F4] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
              <TH>Recruiter</TH>
              <TH>CVs Sent</TH>
              <TH>Interviews</TH>
              <TH>Offers</TH>
              <TH>Placements</TH>
              <TH>IR Value</TH>
            </tr>
          </thead>
          <tbody>
            {recruiterStats.map((r) => (
              <tr key={r.id} className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors">
                <TD className="font-medium text-[#0F0F12]">{r.name}</TD>
                <TD>{r.cvsSent || '—'}</TD>
                <TD>{r.interviews || '—'}</TD>
                <TD>{r.offers || '—'}</TD>
                <TD>{r.placements || '—'}</TD>
                <TD>{r.irValue ? formatMoney(r.irValue) : '—'}</TD>
              </tr>
            ))}
            <tr className="font-semibold text-[#0F0F12]">
              <TD>Total</TD>
              <TD>{totals.cvsSent || '—'}</TD>
              <TD>{totals.interviews || '—'}</TD>
              <TD>{totals.offers || '—'}</TD>
              <TD>{totals.placements || '—'}</TD>
              <TD>{totals.irValue ? formatMoney(totals.irValue) : '—'}</TD>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RevenueByClientTable({ revenueByClient }) {
  const rows = revenueByClient.filter((c) => c.placements > 0 || c.ir > 0)
  return (
    <div className="px-6">
      <SectionHeader>Revenue by Client</SectionHeader>
      <div className="bg-white rounded-xl border border-[#F0F0F4] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
              <TH>Client</TH>
              <TH>Placements</TH>
              <TH>Scores</TH>
              <TH>IR</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.clientId} className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors">
                <TD className="font-medium text-[#0F0F12]">{c.clientName}</TD>
                <TD>{c.placements || '—'}</TD>
                <TD>{formatMoney(c.scores)}</TD>
                <TD>{formatMoney(c.ir)}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AtRiskSection({ atRiskMandates, atRiskCandidates }) {
  const allClear = atRiskMandates.length === 0 && atRiskCandidates.length === 0
  return (
    <div className="px-6">
      <SectionHeader dot>At Risk</SectionHeader>
      {allClear ? (
        <div className="px-4 py-3 rounded-xl border border-emerald-100 bg-emerald-50 text-sm text-emerald-700">
          All clear — no stale mandates or candidates.
        </div>
      ) : (
        <div className="space-y-4">
          {atRiskMandates.length > 0 && (
            <div className="bg-white rounded-xl border border-[#F0F0F4] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
                    <TH>Mandate</TH>
                    <TH>Client</TH>
                    <TH>AM</TH>
                    <TH>Days Since Activity</TH>
                  </tr>
                </thead>
                <tbody>
                  {atRiskMandates.map((m) => (
                    <tr key={m.id} className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors">
                      <TD className="font-medium text-[#0F0F12]">{m.title}</TD>
                      <TD>{m.clientName}</TD>
                      <TD>{m.amName}</TD>
                      <TD><DaysBadge days={m.daysSinceActivity} /></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {atRiskCandidates.length > 0 && (
            <div className="bg-white rounded-xl border border-[#F0F0F4] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
                    <TH>Candidate</TH>
                    <TH>Mandate</TH>
                    <TH>Client</TH>
                    <TH>Stage</TH>
                    <TH>Days in Stage</TH>
                  </tr>
                </thead>
                <tbody>
                  {atRiskCandidates.map((c) => (
                    <tr key={c.mcId} className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors">
                      <TD className="font-medium text-[#0F0F12]">{c.candidateName}</TD>
                      <TD>{c.mandateTitle}</TD>
                      <TD>{c.clientName}</TD>
                      <TD>{c.stage}</TD>
                      <TD><DaysBadge days={c.daysInStage} /></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Projection ──────────────────────────────────────────────────────────────

function fmtMonth(dateStr) {
  if (!dateStr) return ''
  const [y, m] = dateStr.split('-')
  const mon = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
  return `${mon} '${y.slice(2)}`
}

function parseProjectionRows(rows, tab) {
  if (!rows?.length) {
    return tab === 'consolidated' ? [] : { monthLabels: [], people: [] }
  }
  if (tab === 'consolidated') {
    return rows
      .map((r) => ({
        label:          fmtMonth(r.month_start),
        month_index:    Number(r.month_index),
        pipeline_value: Number(r.pipeline_value),
        pipeline_count: Number(r.pipeline_count),
        actual_revenue: Number(r.actual_revenue),
        actual_count:   Number(r.actual_count),
      }))
      .sort((a, b) => a.month_index - b.month_index)
  }

  const byIdx = {}
  for (const r of rows) {
    const i = Number(r.month_index)
    if (!(i in byIdx)) byIdx[i] = fmtMonth(r.month_start)
  }
  const monthLabels = Array.from({ length: 6 }, (_, i) => byIdx[i] ?? '')

  const peopleMap = new Map()
  for (const r of rows) {
    const key = r.group_id ?? '__null__'
    if (!peopleMap.has(key)) {
      peopleMap.set(key, {
        group_id:   r.group_id,
        group_name: r.group_name ?? '—',
        months: Array.from({ length: 6 }, () => ({
          pipeline_value: 0, pipeline_count: 0, actual_revenue: 0, actual_count: 0,
        })),
      })
    }
    const idx = Number(r.month_index)
    if (idx >= 0 && idx < 6) {
      peopleMap.get(key).months[idx] = {
        pipeline_value: Number(r.pipeline_value),
        pipeline_count: Number(r.pipeline_count),
        actual_revenue: Number(r.actual_revenue),
        actual_count:   Number(r.actual_count),
      }
    }
  }

  return {
    monthLabels,
    people: Array.from(peopleMap.values()).sort((a, b) =>
      (a.group_name ?? '').localeCompare(b.group_name ?? '')
    ),
  }
}

function ProjCell({ m, isCurrent }) {
  const showActual   = isCurrent && (m.actual_revenue > 0 || m.actual_count > 0)
  const showPipeline = m.pipeline_value > 0 || m.pipeline_count > 0

  if (!showActual && !showPipeline) {
    return <span className="text-sm text-[#bbb]">—</span>
  }
  return (
    <div className="space-y-2">
      {showActual && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa] mb-0.5">Actual</p>
          <p className="text-sm font-semibold text-[#0F0F12] tabular-nums leading-none">
            {formatMoney(m.actual_revenue)}
          </p>
          <p className="text-xs text-[#999] mt-0.5">
            {m.actual_count} deal{m.actual_count !== 1 ? 's' : ''}
          </p>
        </div>
      )}
      {showPipeline && (
        <div>
          {showActual && (
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa] mb-0.5">Pipeline</p>
          )}
          <p className="text-sm font-medium text-[#0F0F12] tabular-nums leading-none">
            {formatMoney(m.pipeline_value)}
          </p>
          <p className="text-xs text-[#999] mt-0.5">
            {m.pipeline_count} deal{m.pipeline_count !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

const PROJ_TABS = [
  { id: 'consolidated', label: 'Consolidated' },
  { id: 'recruiter',    label: 'By Recruiter' },
  { id: 'spoc',         label: 'By SPOC' },
]

function ProjectionSection() {
  const [projTab, setProjTab] = useState('consolidated')
  const [projData, setProjData] = useState(null)
  const [projLoading, setProjLoading] = useState(false)

  useEffect(() => {
    setProjLoading(true)
    setProjData(null)
    supabase
      .rpc('get_projection', { p_group_by: projTab })
      .then(({ data: rows, error }) => {
        if (!error) setProjData(parseProjectionRows(rows, projTab))
        setProjLoading(false)
      })
  }, [projTab])

  const isGrouped = projTab === 'recruiter' || projTab === 'spoc'

  return (
    <div className="px-6">
      <SectionHeader>Revenue Projection</SectionHeader>

      <div className="flex items-center gap-1.5 mb-4">
        {PROJ_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setProjTab(id)}
            className={`h-7 px-3 rounded-full text-xs font-medium transition ${
              projTab === id
                ? 'bg-[#5E6AD2] text-white'
                : 'bg-[#F0F0F4] text-[#666] hover:bg-[#E8E8EE]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {projLoading && (
        <div className="py-8 text-center text-sm text-[#999]">Loading…</div>
      )}

      {/* Consolidated — 6 month cards */}
      {!projLoading && !isGrouped && Array.isArray(projData) && (
        projData.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#999]">No billing data in the 6-month window.</p>
        ) : (
          <div className="grid grid-cols-6 gap-3">
            {projData.map((m) => (
              <div
                key={m.month_index}
                className={`rounded-xl border p-4 ${
                  m.month_index === 0
                    ? 'border-[#5E6AD2]/30 bg-[#5E6AD2]/[0.03]'
                    : 'border-[#F0F0F4] bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-xs font-semibold text-[#555]">{m.label}</span>
                  {m.month_index === 0 && (
                    <span className="text-[9px] font-semibold bg-[#5E6AD2]/15 text-[#5E6AD2] rounded-full px-1.5 py-0.5 uppercase tracking-wider">
                      Now
                    </span>
                  )}
                </div>

                {m.month_index === 0 ? (
                  <>
                    <div className="mb-3 pb-3 border-b border-[#EBEBF0]">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa] mb-1">
                        Actual Revenue
                      </p>
                      <p className="text-base font-semibold text-[#0F0F12] tabular-nums leading-none">
                        {formatMoney(m.actual_revenue)}
                      </p>
                      <p className="text-xs text-[#999] mt-1">
                        {m.actual_count} deal{m.actual_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa] mb-1">
                        Remaining Pipeline
                      </p>
                      <p className="text-base font-semibold text-[#0F0F12] tabular-nums leading-none">
                        {formatMoney(m.pipeline_value)}
                      </p>
                      <p className="text-xs text-[#999] mt-1">
                        {m.pipeline_count} deal{m.pipeline_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </>
                ) : (
                  m.pipeline_value === 0 && m.pipeline_count === 0 ? (
                    <p className="text-sm text-[#bbb]">—</p>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-[#0F0F12] tabular-nums leading-none">
                        {formatMoney(m.pipeline_value)}
                      </p>
                      <p className="text-xs text-[#999] mt-1">
                        {m.pipeline_count} deal{m.pipeline_count !== 1 ? 's' : ''}
                      </p>
                    </>
                  )
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* By Recruiter / By SPOC — table with months as columns */}
      {!projLoading && isGrouped && projData && (
        projData.people.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#999]">No data.</p>
        ) : (
          <div className="bg-white rounded-xl border border-[#F0F0F4] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
                  <TH>{projTab === 'recruiter' ? 'Recruiter' : 'SPOC'}</TH>
                  {projData.monthLabels.map((label, i) => (
                    <TH key={i}>
                      <span className={i === 0 ? 'text-[#5E6AD2]' : ''}>{label}</span>
                      {i === 0 && (
                        <span className="ml-1.5 text-[9px] font-semibold bg-[#5E6AD2]/15 text-[#5E6AD2] rounded-full px-1.5 py-0.5 uppercase tracking-wider align-middle">
                          now
                        </span>
                      )}
                    </TH>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projData.people.map((person) => (
                  <tr
                    key={person.group_id ?? person.group_name}
                    className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors"
                  >
                    <TD className="font-medium text-[#0F0F12] whitespace-nowrap">{person.group_name}</TD>
                    {person.months.map((m, i) => (
                      <TD key={i} className="align-top">
                        <ProjCell m={m} isCurrent={i === 0} />
                      </TD>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

// ── KpiTab root ──────────────────────────────────────────────────────────────

export default function KpiTab({ role, userId }) {
  const [period, setPeriod] = useState('month')
  const data = useKpiData({ period, role, userId })

  if (data.loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[#999]">
        Loading KPI data…
      </div>
    )
  }

  return (
    <div className="overflow-y-auto flex-1 py-6 space-y-8">
      <PeriodSelector period={period} setPeriod={setPeriod} />

      <div className="mb-8"><HeadlineStrip data={data} /></div>

      <div className="mb-8"><FunnelRatiosSection /></div>

      <div className="mb-8"><ProjectionSection /></div>

      {role !== 'recruiter' && (
        <div className="mb-8"><RecruiterTable recruiterStats={data.recruiterStats} /></div>
      )}

      {role !== 'recruiter' && (
        <div className="mb-8"><RevenueByClientTable revenueByClient={data.revenueByClient} /></div>
      )}

      <div className="mb-8">
        <AtRiskSection atRiskMandates={data.atRiskMandates} atRiskCandidates={data.atRiskCandidates} />
      </div>
    </div>
  )
}
