// Minimal stroke icons for sidebar nav
export function IconDashboard({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  )
}

export function IconPipeline({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 5h14M3 10h10M3 15h6" strokeLinecap="round" />
    </svg>
  )
}

export function IconAddCandidate({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 17c0-3.314 3.134-6 7-6" strokeLinecap="round" />
      <path d="M15 13v4M13 15h4" strokeLinecap="round" />
    </svg>
  )
}

export function IconClients({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="14" height="11" rx="1" />
      <path d="M3 11h14" strokeLinecap="round" />
      <path d="M7 7V5a3 3 0 016 0v2" strokeLinecap="round" />
    </svg>
  )
}

export function IconSettings({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  )
}

export function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="7" r="3" />
      <path d="M2 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round" />
      <path d="M14 5c1.657 0 3 1.343 3 3s-1.343 3-3 3" strokeLinecap="round" />
      <path d="M18 17c0-2.21-1.79-4-4-4" strokeLinecap="round" />
    </svg>
  )
}

export function IconMandates({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 2h8a1 1 0 011 1v14a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M7 7h6M7 10h6M7 13h3" strokeLinecap="round" />
    </svg>
  )
}

export function IconReports({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="16" height="16" rx="1" />
      <path d="M6 14v-4M10 14V8M14 14V6" strokeLinecap="round" />
    </svg>
  )
}
