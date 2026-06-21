import { useState } from 'react'
import AppShell from '../components/layout/AppShell'
import MetricCard from '../components/dashboard/MetricCard'
import DashboardWidget from '../components/dashboard/DashboardWidget'
import CandidateRow from '../components/dashboard/CandidateRow'
import CandidatePanel from '../components/pipeline/CandidatePanel'
import KpiTab from '../pages/KpiTab'
import { useProfile } from '../hooks/useProfile'
import { useDashboardData } from '../hooks/useDashboardData'
import useRole from '../hooks/useRole'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'kpi', label: 'KPI' },
]

const WIDGET_CONFIG = {
  interviews:        { title: 'Interviews today',          badgeColor: 'indigo', badgeLabel: (c) => c.stage,                   showDays: false },
  cvOverdue:         { title: 'CV feedback overdue',       badgeColor: 'red',    badgeLabel: () => 'Processed - FB Pending',    showDays: true  },
  interviewOverdue:  { title: 'Interview feedback ageing', badgeColor: 'amber',  badgeLabel: (c) => c.stage,                   showDays: true  },
  liveL2:            { title: 'Live L2+ pipeline',         badgeColor: 'green',  badgeLabel: (c) => c.stage,                   showDays: false },
}

export default function Dashboard() {
  const profile = useProfile()
  const { data, loading, refresh } = useDashboardData(profile)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedMetric, setSelectedMetric] = useState('interviews')
  const { role } = useRole()

  const interviews = data?.interviewsToday ?? []
  const cvOverdue = data?.cvFeedbackOverdue ?? []
  const interviewOverdue = data?.interviewFeedbackOverdue ?? []
  const liveL2 = data?.liveL2Plus ?? []

  const listMap = { interviews, cvOverdue, interviewOverdue, liveL2 }
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
          <div className="p-6 space-y-4 max-w-6xl">

            {/* Metric strip — 4 columns, each card clickable */}
            <div className="grid grid-cols-4 gap-4">
              <MetricCard
                label="Interviews today"
                value={loading ? '…' : interviews.length}
                accent="#5E6AD2"
                selected={selectedMetric === 'interviews'}
                onClick={() => setSelectedMetric('interviews')}
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
            <div style={{ height: 420 }}>
              <DashboardWidget
                title={activeConfig.title}
                empty={!loading && activeList.length === 0}
              >
                {activeList.map((c) => (
                  <CandidateRow
                    key={c._mc_id}
                    candidate={c}
                    badgeLabel={activeConfig.badgeLabel(c)}
                    badgeColor={activeConfig.badgeColor}
                    daysOverdue={activeConfig.showDays ? c.daysOverdue : undefined}
                    onClick={setSelectedCandidate}
                  />
                ))}
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
