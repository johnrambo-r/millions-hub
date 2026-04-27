import AppShell from '../components/layout/AppShell'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AppShell title="Settings">
      <div className="p-6 space-y-4">
        <p className="text-sm text-[#999]">Settings — coming soon</p>
        <button
          onClick={handleSignOut}
          className="text-sm text-[#D93025] hover:underline"
        >
          Sign out
        </button>
      </div>
    </AppShell>
  )
}
