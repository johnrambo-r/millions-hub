import { useState } from 'react'
import AppShell from '../components/layout/AppShell'
import MetricCard from '../components/dashboard/MetricCard'
import DashboardWidget from '../components/dashboard/DashboardWidget'
import CandidateRow, { InStageBadge } from '../components/dashboard/CandidateRow'
import CandidateCard from '../components/pipeline/CandidateCard'
import CandidatePanel from '../components/pipeline/CandidatePanel'
import KpiTab from '../pages/KpiTab'
import { useProfile } from '../hooks/useProfile'
import { useDashboardData } from '../hooks/useDashboardData'
import useRole from '../hooks/useRole'
import { formatTime12h } from '../lib/formatTime'

const INTERVIEW_STAGES = new Set(['L1', 'L2', 'L3', 'Client Onsite', 'HR'])

// Plain-text equivalent of CandidateRow's interview/DOJ cell, for the mobile
// card's detailLines (which take strings, not JSX).
function interviewDojLine(c) {
  if (INTERVIEW_STAGES.has(c.stage)) {
    if (!c.interview_date) return null
    const d = new Date(c.interview_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return `Interview: ${d}${c.interview_time ? `, ${formatTime12h(c.interview_time)}` : ''}`
  }
  if (c.stage === 'Offer' || c.stage === 'Joining') {
    if (!c.date_of_joining) return null
    const d = new Date(c.date_of_joining).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    return `DOJ: ${d}`
  }
  return null
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'kpi', label: 'KPI' },
]

const WIDGET_CONFIG = {
  interviews:         { title: 'Interviews today' },
  interviewsTomorrow: { title: 'Interviews tomorrow' },
  interviewsNext7:    { title: 'Interviews in next 7 days' },
  cvOverdue:          { title: 'CV feedback overdue' },
  interviewOverdue:   { title: 'Interview feedback ageing' },
  liveL2:             { title: 'Live L2+ pipeline' },
}

const TH = ({ children, className = '' }) => (
  <th className={`px-4 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap ${className}`}>
    {children}
  </th>
)

export default function Dashboard() {
  const profile = useProfile()
  const { data, loading, refresh } = useDashboardData(profile)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedMetric, setSelectedMetric] = useState('interviews')
  const { role } = useRole()

  const interviews = data?.interviewsToday ?? []
  const interviewsTomorrow = data?.interviewsTomorrow ?? []
  const interviewsNext7 = data?.interviewsNext7Days ?? []
  const cvOverdue = data?.cvFeedbackOverdue ?? []
  const interviewOverdue = data?.interviewFeedbackOverdue ?? []
  const liveL2 = data?.liveL2Plus ?? []

  const listMap = { interviews, interviewsTomorrow, interviewsNext7, cvOverdue, interviewOverdue, liveL2 }
  const activeList = listMap[selectedMetric] ?? []
  const activeConfig = WIDGET_CONFIG[selectedMetric]

  return (
    <AppShell title="Dashboard">
      <div className="flex flex-col h-full">

        {/* Tab bar */}
        <div className="px-6 border-b border-[#F0F0F4] bg-white flex items-center gap-1 shrink-0">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-[#5E6AD2] text-[#5E6AD2]'
                  : 'border-transparent text-[#999] hover:text-[#666]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'kpi' && <KpiTab role={role} userId={profile?.id} />}

        {activeTab === 'overview' && (
          <div className="p-4 md:p-6 space-y-4 max-w-[1400px]">

            {/* Metric strip — 3 columns x 2 rows on desktop, 2 columns on mobile, each card clickable */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard
                label="Interviews today"
                value={loading ? '…' : interviews.length}
                accent="#5E6AD2"
                selected={selectedMetric === 'interviews'}
                onClick={() => setSelectedMetric('interviews')}
              />
              <MetricCard
                label="Interviews tomorrow"
                value={loading ? '…' : interviewsTomorrow.length}
                accent="#5E6AD2"
                selected={selectedMetric === 'interviewsTomorrow'}
                onClick={() => setSelectedMetric('interviewsTomorrow')}
              />
              <MetricCard
                label="Interviews in next 7 days"
                value={loading ? '…' : interviewsNext7.length}
                accent="#5E6AD2"
                selected={selectedMetric === 'interviewsNext7'}
                onClick={() => setSelectedMetric('interviewsNext7')}
              />
              <MetricCard
                label="CV feedback overdue"
                value={loading ? '…' : cvOverdue.length}
                accent={cvOverdue.length > 0 ? '#D93025' : '#0F0F12'}
                selected={selectedMetric === 'cvOverdue'}
                onClick={() => setSelectedMetric('cvOverdue')}
              />
              <MetricCard
                label="Interview feedback overdue"
                value={loading ? '…' : interviewOverdue.length}
                accent={interviewOverdue.length > 0 ? '#B45309' : '#0F0F12'}
                selected={selectedMetric === 'interviewOverdue'}
                onClick={() => setSelectedMetric('interviewOverdue')}
              />
              <MetricCard
                label="Live L2+ candidates"
                value={loading ? '…' : liveL2.length}
                accent="#1D8A5E"
                selected={selectedMetric === 'liveL2'}
                onClick={() => setSelectedMetric('liveL2')}
              />
            </div>

            {/* Single full-width widget — switches based on selectedMetric */}
            <div className="md:h-[460px]">
              <DashboardWidget
                title={activeConfig.title}
                empty={!loading && activeList.length === 0}
              >
                <div className="hidden md:block">
                  <table className="w-full min-w-[1000px] border-collapse">
                    <thead className="sticky top-0 z-10 bg-white border-b border-[#F0F0F4]">
                      <tr>
                        <TH>Candidate</TH>
                        <TH>Contact</TH>
                        <TH>Client · Mandate</TH>
                        <TH className="w-28">Stage</TH>
                        <TH className="w-36">Status</TH>
                        <TH className="w-32">Interview / DOJ</TH>
                        <TH>Recruiter · AM</TH>
                        <TH className="w-24">In Stage</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {activeList.map((c) => (
                        <CandidateRow
                          key={c._mc_id}
                          candidate={c}
                          onClick={setSelectedCandidate}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden">
                  {activeList.map((c) => (
                    <CandidateCard
                      key={c._mc_id}
                      onClick={() => setSelectedCandidate(c)}
                      applicantId={c.applicant_id}
                      name={c.name}
                      meta={[c.mandates?.clients?.name, c.mandates?.title].filter(Boolean).join(' · ') || undefined}
                      stage={c.stage}
                      status={c.status}
                      aging={<InStageBadge dateStr={c.status_changed_at} />}
                      detailLines={[
                        c.phone,
                        c.email,
                        c.linked_by_profile?.name ? `Recruiter: ${c.linked_by_profile.name}` : null,
                        c.mandates?.am?.name ? `AM: ${c.mandates.am.name}` : null,
                        interviewDojLine(c),
                      ].filter(Boolean)}
                    />
                  ))}
                </div>
              </DashboardWidget>
            </div>

          </div>
        )}

      </div>

      <CandidatePanel
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onUpdate={(patch) => {
          if (patch && selectedCandidate) {
            setSelectedCandidate((prev) => ({ ...prev, ...patch }))
          }
          refresh()
        }}
      />
    </AppShell>
  )
}
