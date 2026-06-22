import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
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
      {/* Content area: offset left by sidebar width (44px) and top by topbar (40px) */}
      <main
        className="overflow-y-auto"
        style={{ marginLeft: 44, marginTop: 40, height: 'calc(100vh - 40px)' }}
      >
        {children}
      </main>
      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
