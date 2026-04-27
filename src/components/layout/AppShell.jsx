import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell({ title, children }) {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <Topbar title={title} />
      {/* Content area: offset left by sidebar width (44px) and top by topbar (40px) */}
      <main
        className="overflow-y-auto"
        style={{ marginLeft: 44, marginTop: 40, height: 'calc(100vh - 40px)' }}
      >
        {children}
      </main>
    </div>
  )
}
