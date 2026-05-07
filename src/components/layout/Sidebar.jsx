import { NavLink } from 'react-router-dom'
import {
  IconDashboard, IconPipeline, IconAddCandidate, IconClients,
  IconSettings, IconUsers, IconMandates, IconReports,
} from './NavIcons'
import useRole from '../../hooks/useRole'

const FOUNDER_NAV = [
  { to: '/dashboard', icon: IconDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: IconPipeline, label: 'Pipeline' },
  { to: '/clients', icon: IconClients, label: 'Clients' },
  { to: '/mandates', icon: IconMandates, label: 'Mandates' },
  { to: '/users', icon: IconUsers, label: 'Users' },
  { to: '/reports', icon: IconReports, label: 'Reports' },
  { to: '/add', icon: IconAddCandidate, label: 'Add Candidate' },
  { to: '/settings', icon: IconSettings, label: 'Settings' },
]

const ACCOUNT_MANAGER_NAV = [
  { to: '/dashboard', icon: IconDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: IconPipeline, label: 'Pipeline' },
  { to: '/clients', icon: IconClients, label: 'Clients' },
  { to: '/mandates', icon: IconMandates, label: 'Mandates' },
  { to: '/add', icon: IconAddCandidate, label: 'Add Candidate' },
  { to: '/settings', icon: IconSettings, label: 'Settings' },
]

const RECRUITER_NAV = [
  { to: '/dashboard', icon: IconDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: IconPipeline, label: 'Pipeline' },
  { to: '/mandates', icon: IconMandates, label: 'Mandates' },
  { to: '/add', icon: IconAddCandidate, label: 'Add Candidate' },
  { to: '/settings', icon: IconSettings, label: 'Settings' },
]

function getNav(role) {
  if (role === 'founder') return FOUNDER_NAV
  if (role === 'account_manager') return ACCOUNT_MANAGER_NAV
  if (role === 'recruiter') return RECRUITER_NAV
  return FOUNDER_NAV
}

function NavIcon({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
          isActive
            ? 'bg-[#1E1E24] text-white'
            : 'text-[#555] hover:text-[#888] hover:bg-[#1A1A20]'
        }`
      }
    >
      <Icon className="w-5 h-5" />
    </NavLink>
  )
}

function Avatar({ name }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return (
    <div className="w-8 h-8 rounded-full bg-[#5E6AD2] flex items-center justify-center text-white text-xs font-semibold select-none">
      {initials}
    </div>
  )
}

export default function Sidebar() {
  const { role, profile, loading } = useRole()
  const nav = loading ? [] : getNav(role)

  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col items-center py-3 gap-1 z-30"
      style={{ width: 44, backgroundColor: '#0F0F12' }}
    >
      {/* Logo mark */}
      <div className="w-8 h-8 flex items-center justify-center rounded-md bg-[#0F0F12] border border-[#2a2a30] mb-3 select-none shrink-0">
        <span className="text-white font-bold text-xs tracking-tight">MA</span>
      </div>

      {/* Nav icons */}
      <nav className="flex flex-col gap-1 flex-1">
        {nav.map((item) => (
          <NavIcon key={item.to} {...item} />
        ))}
      </nav>

      {/* User avatar */}
      <Avatar name={profile?.name} />
    </aside>
  )
}
