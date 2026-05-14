import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import useRole from '../hooks/useRole'
import { useAuth } from '../context/AuthContext'

const ROLES = ['founder', 'account_manager', 'recruiter']

const ROLE_LABELS = {
  founder: 'Founder',
  account_manager: 'Account Manager',
  recruiter: 'Recruiter',
}

const ROLE_STYLES = {
  founder: 'bg-purple-50 text-purple-700',
  account_manager: 'bg-blue-50 text-blue-700',
  recruiter: 'bg-green-50 text-green-700',
}

function RoleBadge({ value }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${ROLE_STYLES[value] ?? 'bg-gray-100 text-gray-500'}`}>
      {ROLE_LABELS[value] ?? value ?? '—'}
    </span>
  )
}

function formatLastActive(str) {
  if (!str) return '—'
  const d = new Date(str)
  const diffDays = Math.floor((Date.now() - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TH = ({ children, className = '' }) => (
  <th className={`px-4 py-2.5 text-left text-xs font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap ${className}`}>
    {children}
  </th>
)

const TD = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
)

const fldCls = 'h-8 rounded-lg border border-[#F0F0F4] bg-white px-2 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited, currentUserId }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('recruiter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef()

  useEffect(() => { nameRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleInvite(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }
    if (!supabaseAdmin) {
      setError('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file.')
      return
    }
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      { data: { name: name.trim() } },
    )
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const userId = authData.user.id
    const now = new Date().toISOString()
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        name: name.trim(),
        email: email.trim(),
        role,
        active: true,
        invited_by: currentUserId,
        created_at: now,
        updated_at: now,
      })

    setLoading(false)
    if (profileError) {
      setError(profileError.message)
      return
    }

    onInvited({ id: userId, name: name.trim(), email: email.trim(), role, active: true, created_at: now })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl border border-[#F0F0F4] w-full max-w-md pointer-events-auto">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#F0F0F4]">
            <h2 className="text-base font-semibold text-[#0F0F12]">Invite User</h2>
            <button onClick={onClose} className="text-[#999] hover:text-[#0F0F12] transition-colors">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleInvite} className="px-6 py-5 space-y-4">
            {error && (
              <div className="text-xs text-[#D93025] bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">
                Full Name
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition"
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition"
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-9 px-5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#5E6AD2' }}
              >
                {loading ? 'Sending invite…' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ── User Row ──────────────────────────────────────────────────────────────────

function UserRow({ user, currentUserId, onRoleChange, onActiveToggle }) {
  const [editingRole, setEditingRole] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  const [savingActive, setSavingActive] = useState(false)
  const selectRef = useRef()
  const isSelf = user.id === currentUserId

  useEffect(() => {
    if (editingRole) selectRef.current?.focus()
  }, [editingRole])

  async function handleRoleChange(newRole) {
    if (newRole === user.role) { setEditingRole(false); return }
    setSavingRole(true)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    setSavingRole(false)
    setEditingRole(false)
    if (!error) onRoleChange(user.id, newRole)
  }

  async function handleActiveToggle() {
    if (savingActive) return
    setSavingActive(true)
    const newActive = !user.active
    const { error } = await supabase
      .from('profiles')
      .update({ active: newActive, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    setSavingActive(false)
    if (!error) onActiveToggle(user.id, newActive)
  }

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <tr className="border-b border-[#F0F0F4] hover:bg-[#FAFAFA] transition-colors">
      <TD>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#5E6AD2] flex items-center justify-center text-white text-xs font-semibold select-none shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[#0F0F12] truncate max-w-[140px]">{user.name ?? '—'}</p>
            {isSelf && <p className="text-[10px] text-[#5E6AD2] font-medium leading-tight">You</p>}
          </div>
        </div>
      </TD>
      <TD>
        <span className="text-[#666] block truncate max-w-[200px]">{user.email ?? '—'}</span>
      </TD>
      <TD>
        {editingRole ? (
          <select
            ref={selectRef}
            defaultValue={user.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            onBlur={() => setEditingRole(false)}
            disabled={savingRole}
            className={fldCls}
          >
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        ) : (
          <button
            onClick={() => !isSelf && setEditingRole(true)}
            title={isSelf ? 'Cannot change your own role' : 'Click to change role'}
            className={`flex items-center gap-1.5 ${isSelf ? 'cursor-default' : 'hover:opacity-75 transition-opacity'}`}
          >
            <RoleBadge value={user.role} />
            {!isSelf && (
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 text-[#bbb]">
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
      </TD>
      <TD>
        <button
          onClick={() => !isSelf && handleActiveToggle()}
          disabled={savingActive || isSelf}
          title={isSelf ? 'Cannot change your own status' : (user.active ? 'Click to deactivate' : 'Click to activate')}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-opacity ${
            isSelf ? 'cursor-default' : 'hover:opacity-75 cursor-pointer'
          } ${user.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
        >
          {savingActive ? '…' : (user.active ? 'Active' : 'Inactive')}
        </button>
      </TD>
      <TD>
        <span className="text-[#666]">{formatLastActive(user.last_active)}</span>
      </TD>
    </tr>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Users() {
  const { isFounder, loading: roleLoading } = useRole()
  const { session } = useAuth()
  const currentUserId = session?.user?.id

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')

  useEffect(() => {
    if (roleLoading) return
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        console.log('profiles result:', data, err)
setLoading(false)
        if (err) setError(err.message)
        else setUsers(data ?? [])
      })
  }, [roleLoading])

  if (roleLoading) return null
  if (!isFounder) return <Navigate to="/dashboard" replace />

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  function handleRoleChange(id, newRole) {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u))
  }

  function handleActiveToggle(id, newActive) {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: newActive } : u))
  }

  function handleInvited(newUser) {
    setUsers((prev) => [...prev, newUser])
    setShowInvite(false)
    setInviteSuccess(`Invite sent to ${newUser.name}.`)
    setTimeout(() => setInviteSuccess(''), 5000)
  }

  return (
    <AppShell title="Users">
      <div className="flex flex-col h-full">

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-[#F0F0F4] bg-white flex items-center gap-3 flex-wrap shrink-0">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none"
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
            >
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10.5 10.5l3 3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-52"
            />
          </div>

          <span className="text-xs text-[#999] ml-auto">
            {loading ? '…' : `${filtered.length} user${filtered.length !== 1 ? 's' : ''}`}
          </span>

          <button
            onClick={() => setShowInvite(true)}
            className="h-8 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 flex items-center gap-1.5"
            style={{ backgroundColor: '#5E6AD2' }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            Invite User
          </button>
        </div>

        {inviteSuccess && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 shrink-0">
            {inviteSuccess}
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 shrink-0">
            Failed to load users: {error}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-[#999]">
              Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-[#999]">
              {search ? 'No users match the search' : 'No users found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse">
                <thead>
                  <tr className="border-b border-[#F0F0F4] bg-[#FAFAFA]">
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Role</TH>
                    <TH>Status</TH>
                    <TH>Last Active</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      currentUserId={currentUserId}
                      onRoleChange={handleRoleChange}
                      onActiveToggle={handleActiveToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={handleInvited}
          currentUserId={currentUserId}
        />
      )}
    </AppShell>
  )
}
