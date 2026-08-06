import {
  IconDashboard, IconPipeline, IconAddCandidate, IconClients,
  IconSettings, IconUsers, IconMandates,
} from './NavIcons'

// Single source of truth for role-based nav items, shared by the desktop
// Sidebar and the mobile bottom tab bar / "More" sheet.

export const FOUNDER_NAV = [
  { to: '/dashboard', icon: IconDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: IconPipeline, label: 'Candidates' },
  { to: '/clients', icon: IconClients, label: 'Clients' },
  { to: '/mandates', icon: IconMandates, label: 'Mandates' },
  { to: '/users', icon: IconUsers, label: 'Users' },
  { to: '/add', icon: IconAddCandidate, label: 'Add Candidate' },
  { to: '/settings', icon: IconSettings, label: 'Settings' },
]

export const ACCOUNT_MANAGER_NAV = [
  { to: '/dashboard', icon: IconDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: IconPipeline, label: 'Candidates' },
  { to: '/clients', icon: IconClients, label: 'Clients' },
  { to: '/mandates', icon: IconMandates, label: 'Mandates' },
  { to: '/add', icon: IconAddCandidate, label: 'Add Candidate' },
  { to: '/settings', icon: IconSettings, label: 'Settings' },
]

export const RECRUITER_NAV = [
  { to: '/dashboard', icon: IconDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: IconPipeline, label: 'Candidates' },
  { to: '/mandates', icon: IconMandates, label: 'Mandates' },
  { to: '/add', icon: IconAddCandidate, label: 'Add Candidate' },
  { to: '/settings', icon: IconSettings, label: 'Settings' },
]

export function getNav(role) {
  if (role === 'founder') return FOUNDER_NAV
  if (role === 'account_manager') return ACCOUNT_MANAGER_NAV
  if (role === 'recruiter') return RECRUITER_NAV
  return FOUNDER_NAV
}

// Most-used items shown directly as bottom-tab icons on mobile; everything
// else in a role's nav (e.g. Add Candidate, Users, Settings) goes in "More".
export const PRIMARY_PATHS = ['/dashboard', '/pipeline', '/clients', '/mandates']
