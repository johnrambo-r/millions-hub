import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { IconSearch, IconMore, IconUsers } from './NavIcons'
import { getNav, PRIMARY_PATHS } from './navConfig'
import useRole from '../../hooks/useRole'
import { useProfile } from '../../hooks/useProfile'
import { supabase } from '../../lib/supabase'

function TabIcon({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 ${
          isActive ? 'text-[#5E6AD2]' : 'text-[#888]'
        }`
      }
    >
      <Icon className="w-6 h-6 shrink-0" />
      <span className="text-[10px] font-medium truncate max-w-full px-0.5">{label}</span>
    </NavLink>
  )
}

function Avatar({ name }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return (
    <div className="w-9 h-9 rounded-full bg-[#5E6AD2] flex items-center justify-center text-white text-sm font-semibold select-none shrink-0">
      {initials}
    </div>
  )
}

function MoreSheet({ items, onSearchOpen, profile, onClose }) {
  const navigate = useNavigate()

  async function handleSignOut() {
    onClose()
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[75vh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-sm font-semibold text-[#0F0F12]">More</span>
          <button onClick={onClose} className="text-[#999] hover:text-[#0F0F12] transition-colors" aria-label="Close">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-2 pb-2">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#F0F0F4] text-[#5E6AD2]' : 'text-[#0F0F12] hover:bg-[#FAFAFA]'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => { onClose(); onSearchOpen() }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-[#0F0F12] hover:bg-[#FAFAFA] transition-colors"
          >
            <IconSearch className="w-5 h-5 shrink-0" />
            Search
          </button>
        </div>

        <div className="border-t border-[#F0F0F4] px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0F0F12] truncate">{profile?.name ?? 'Account'}</p>
              <button onClick={handleSignOut} className="text-xs text-[#D93025] hover:underline">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MobileNav({ onSearchOpen }) {
  const { role, loading } = useRole()
  const profile = useProfile()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const nav = loading ? [] : getNav(role)
  const primary = nav.filter((item) => PRIMARY_PATHS.includes(item.to))

  const moreItems = []
  for (const item of nav) {
    if (PRIMARY_PATHS.includes(item.to)) continue
    moreItems.push(item)
    if (item.to === '/users') {
      moreItems.push({ to: '/users?invite=1', icon: IconUsers, label: 'Add User' })
    }
  }

  const isPrimaryActive = PRIMARY_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  )

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#F0F0F4] flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primary.map((item) => (
          <TabIcon key={item.to} {...item} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 ${
            !isPrimaryActive ? 'text-[#5E6AD2]' : 'text-[#888]'
          }`}
        >
          <IconMore className="w-6 h-6 shrink-0" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {moreOpen && (
        <MoreSheet
          items={moreItems}
          profile={profile}
          onSearchOpen={onSearchOpen}
          onClose={() => setMoreOpen(false)}
        />
      )}
    </>
  )
}
