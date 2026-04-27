import { useNavigate } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'

export default function Topbar({ title }) {
  const profile = useProfile()
  const navigate = useNavigate()

  return (
    <header
      className="fixed top-0 right-0 flex items-center justify-between px-5 border-b border-[#F0F0F4] bg-white z-20"
      style={{ left: 44, height: 40 }}
    >
      <span className="text-sm font-semibold text-[#0F0F12]">{title}</span>

      <div className="flex items-center gap-3">
        {profile && (
          <span className="text-xs font-medium text-[#666] bg-[#F0F0F4] rounded-full px-3 py-0.5">
            {profile.name}
          </span>
        )}
        <button
          onClick={() => navigate('/add')}
          className="text-xs font-semibold text-white rounded-lg px-3 py-1.5 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#5E6AD2' }}
        >
          + Add Candidate
        </button>
      </div>
    </header>
  )
}
