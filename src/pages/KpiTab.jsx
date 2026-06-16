import { useState } from 'react'
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

function FunnelSection({ funnelStages }) {
  return (
    <div className="px-6">
      <SectionHeader>Funnel</SectionHeader>
      <div className="px-6 py-4 bg-white rounded-xl border border-[#F0F0F4] flex items-stretch overflow-x-auto">
        {funnelStages.map((s, i) => {
          const prev = funnelStages[i - 1]
          const rate = prev && prev.count > 0 ? Math.round((s.count / prev.count) * 100) : null
          return (
            <div key={s.stage} className="flex items-center">
              {i > 0 && <span className="text-[#D9D9E3] mx-3">→</span>}
              <div className="flex flex-col items-center min-w-[64px]">
                <span className="text-xs text-[#999]">{s.label}</span>
                <span className="text-xl font-bold text-[#0F0F12] tabular-nums">{s.count}</span>
                <span className="text-xs text-[#999]">{rate != null ? `↓ ${rate}%` : ' '}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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

      <div className="mb-8"><FunnelSection funnelStages={data.funnelStages} /></div>

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
