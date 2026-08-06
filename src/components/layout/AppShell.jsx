import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import UniversalSearch from '../UniversalSearch'

export default function AppShell({ title, children }) {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <Sidebar onSearchOpen={() => setSearchOpen(true)} />
      <Topbar title={title} />
      {/* Content area: offset left by sidebar width (44px, desktop only) and
          top by topbar (40px). On mobile, no left offset, and height leaves
          room at the bottom for the fixed bottom tab bar (60px). */}
      <main
        className="overflow-y-auto ml-0 md:ml-[44px] mt-10 h-[calc(100vh_-_100px)] md:h-[calc(100vh_-_40px)]"
      >
        {children}
      </main>
      <MobileNav onSearchOpen={() => setSearchOpen(true)} />
      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
