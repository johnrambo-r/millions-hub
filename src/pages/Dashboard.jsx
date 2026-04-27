import { useState } from 'react'
import AppShell from '../components/layout/AppShell'
import MetricCard from '../components/dashboard/MetricCard'
import DashboardWidget from '../components/dashboard/DashboardWidget'
import CandidateRow from '../components/dashboard/CandidateRow'
import CandidatePanel from '../components/pipeline/CandidatePanel'
import { useProfile } from '../hooks/useProfile'
import { useDashboardData } from '../hooks/useDashboardData'

export default function Dashboard() {
  const profile = useProfile()
  const { data, loading } = useDashboardData(profile)
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  const interviews = data?.interviewsToday ?? []
  const cvOverdue = data?.cvFeedbackOverdue ?? []
  const interviewOverdue = data?.interviewFeedbackOverdue ?? []
  const liveL2 = data?.liveL2Plus ?? []

  return (
    <AppShell title="Dashboard">
      <div className="p-6 space-y-6 max-w-6xl">

        {/* Metric cards — 2×2 grid */}
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Interviews today"
            value={loading ? '…' : interviews.length}
            accent="#5E6AD2"
          />
          <MetricCard
            label="CV feedback overdue"
            value={loading ? '…' : cvOverdue.length}
            accent={cvOverdue.length > 0 ? '#D93025' : '#0F0F12'}
          />
          <MetricCard
            label="Interview feedback overdue"
            value={loading ? '…' : interviewOverdue.length}
            accent={interviewOverdue.length > 0 ? '#B45309' : '#0F0F12'}
          />
          <MetricCard
            label="Live L2+ candidates"
            value={loading ? '…' : liveL2.length}
            accent="#1D8A5E"
          />
        </div>

        {/* Widgets — 2×2 grid */}
        <div className="grid grid-cols-2 gap-4" style={{ minHeight: 320 }}>
          <DashboardWidget
            title="Interviews today"
            empty={!loading && interviews.length === 0}
          >
            {interviews.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                badgeLabel={c.stage}
                badgeColor="indigo"
                onClick={setSelectedCandidate}
              />
            ))}
          </DashboardWidget>

          <DashboardWidget
            title="CV feedback overdue"
            empty={!loading && cvOverdue.length === 0}
          >
            {cvOverdue.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                badgeLabel="FB Pending"
                badgeColor="red"
                daysOverdue={c.daysOverdue}
                onClick={setSelectedCandidate}
              />
            ))}
          </DashboardWidget>

          <DashboardWidget
            title="Interview feedback ageing"
            empty={!loading && interviewOverdue.length === 0}
          >
            {interviewOverdue.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                badgeLabel={c.stage}
                badgeColor="amber"
                daysOverdue={c.daysOverdue}
                onClick={setSelectedCandidate}
              />
            ))}
          </DashboardWidget>

          <DashboardWidget
            title="Live L2+ pipeline"
            empty={!loading && liveL2.length === 0}
          >
            {liveL2.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                badgeLabel={c.stage}
                badgeColor="green"
                onClick={setSelectedCandidate}
              />
            ))}
          </DashboardWidget>
        </div>

      </div>

      <CandidatePanel
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </AppShell>
  )
}
