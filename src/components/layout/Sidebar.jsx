import { NavLink } from 'react-router-dom'
import { IconSearch } from './NavIcons'
import { getNav } from './navConfig'
import useRole from '../../hooks/useRole'

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

export default function Sidebar({ onSearchOpen }) {
  const { role, profile, loading } = useRole()
  const nav = loading ? [] : getNav(role)

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-full flex-col items-center py-3 gap-1 z-30"
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

      {/* Search button */}
      <button
        onClick={onSearchOpen}
        title="Search (⌘K)"
        className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-[#555] hover:text-[#888] hover:bg-[#1A1A20] mb-1"
      >
        <IconSearch className="w-5 h-5" />
      </button>

      {/* User avatar */}
      <Avatar name={profile?.name} />
    </aside>
  )
}
