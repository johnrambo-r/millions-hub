import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AccountStatusBadge, ClientTypeBadge } from '../pages/Clients'
import { StageBadge, StatusBadge } from './pipeline/StageBadge'
import UnsavedChangesModal from './UnsavedChangesModal'

function Field({ label, children, colSpan2 = false }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium text-[#999] uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-[#0F0F12] break-words">{children || '—'}</dd>
    </div>
  )
}

function EditField({ label, children, colSpan2 = false }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : ''}>
      <label className="text-xs font-medium text-[#999] uppercase tracking-wide mb-1 block">{label}</label>
      {children}
    </div>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  )
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fldCls = 'h-9 w-full rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition'

const ACCOUNT_STATUSES = ['Active', 'On Hold', 'Inactive']
const CLIENT_TYPES = ['GCC', 'Product Startup', 'IT Services', 'Consulting']

const EDITABLE_FIELDS = [
  'name', 'industry', 'client_type', 'location', 'website', 'about',
  'primary_contact_name', 'primary_contact_designation',
  'primary_contact_email', 'primary_contact_phone',
  'account_status', 'notes',
]

function initEditFields(client) {
  const fields = {}
  EDITABLE_FIELDS.forEach((k) => { fields[k] = client?.[k] ?? '' })
  return fields
}

// ─── Candidates tab ─────────────────────────────────────────────────────────

function LinkedCandidates({ clientId }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    supabase
      .from('candidates')
      .select('id, name, skill_role, stage, status, email')
      .eq('client_id', clientId)
      .order('name')
      .then(({ data }) => {
        setCandidates(data ?? [])
        setLoading(false)
      })
  }, [clientId])

  if (loading) return <p className="text-sm text-[#999]">Loading…</p>
  if (candidates.length === 0) {
    return <p className="text-sm text-[#999]">No candidates linked to this client.</p>
  }

  return (
    <ul className="space-y-2">
      {candidates.map((c) => (
        <li key={c.id} className="rounded-lg border border-[#F0F0F4] px-4 py-3 bg-[#FAFAFA]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#0F0F12] truncate">{c.name}</p>
              <p className="text-xs text-[#666] mt-0.5 truncate">{c.skill_role ?? '—'}</p>
              {c.email && <p className="text-xs text-[#999] mt-0.5 truncate">{c.email}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StageBadge value={c.stage} />
              <StatusBadge value={c.status} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export default function ClientPanel({ client, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('details')
  const [isEditing, setIsEditing] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [isDirty, setIsDirty] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [dialogSaving, setDialogSaving] = useState(false)

  const originalFieldsRef = useRef({})
  const isOpen = !!client

  useEffect(() => {
    if (isDirty) {
      window.onbeforeunload = () => true
    } else {
      window.onbeforeunload = null
    }
    return () => { window.onbeforeunload = null }
  }, [isDirty])

  useEffect(() => {
    if (!isEditing) return
    const orig = originalFieldsRef.current
    const dirty = Object.keys(editFields).some((k) => editFields[k] !== orig[k])
    setIsDirty(dirty)
  }, [editFields, isEditing])

  useEffect(() => {
    if (!client) {
      setIsEditing(false)
      setEditError('')
      setEditSuccess(false)
      setIsDirty(false)
      setDialog(null)
      setActiveTab('details')
      return
    }
    setIsEditing(false)
    setEditError('')
    setEditSuccess(false)
    setIsDirty(false)
    setActiveTab('details')
  }, [client?.id])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') handleRequestClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditing, isDirty])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function resetEditState() {
    setIsEditing(false)
    setEditError('')
    setIsDirty(false)
  }

  function handleRequestClose() {
    if (isEditing && isDirty) {
      setDialog({
        message: 'You have unsaved changes. What would you like to do?',
        onSave: async () => {
          setDialogSaving(true)
          const ok = await performSave()
          setDialogSaving(false)
          setDialog(null)
          if (ok) onClose()
        },
        onDiscard: () => {
          resetEditState()
          setDialog(null)
          onClose()
        },
        onCancel: () => setDialog(null),
      })
    } else {
      onClose()
    }
  }

  function handleEditStart() {
    const fields = initEditFields(client)
    originalFieldsRef.current = { ...fields }
    setEditFields(fields)
    setEditError('')
    setEditSuccess(false)
    setIsDirty(false)
    setIsEditing(true)
  }

  function setEditField(key, value) {
    setEditFields((prev) => ({ ...prev, [key]: value }))
  }

  function handleEditCancel() {
    if (isDirty) {
      setDialog({
        message: 'Do you want to save your changes before cancelling?',
        onSave: async () => {
          setDialogSaving(true)
          await performSave()
          setDialogSaving(false)
          setDialog(null)
        },
        onDiscard: () => {
          resetEditState()
          setDialog(null)
        },
        onCancel: () => setDialog(null),
      })
    } else {
      resetEditState()
    }
  }

  async function performSave() {
    setEditSaving(true)
    setEditError('')

    const payload = {}
    EDITABLE_FIELDS.forEach((k) => {
      payload[k] = editFields[k]?.trim?.() !== undefined
        ? (editFields[k].trim() || null)
        : (editFields[k] || null)
    })
    payload.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', client.id)

    setEditSaving(false)

    if (error) {
      setEditError(error.message)
      return false
    }

    setIsEditing(false)
    setIsDirty(false)
    setEditSuccess(true)
    setTimeout(() => setEditSuccess(false), 3000)
    onUpdate?.(payload)
    return true
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleRequestClose}
      />

      {/* Slide-in panel */}
      <div
        className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out"
        style={{ width: 480, transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        aria-modal="true"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#F0F0F4] shrink-0">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-[#0F0F12] truncate">{client?.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <AccountStatusBadge value={client?.account_status} />
              <ClientTypeBadge value={client?.client_type} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing ? (
              <button
                onClick={handleEditStart}
                className="h-8 px-3 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:border-[#5E6AD2] hover:text-[#5E6AD2] transition"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleEditCancel}
                  className="h-8 px-3 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={performSave}
                  disabled={editSaving}
                  className="h-8 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#5E6AD2' }}
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            )}
            <button
              onClick={handleRequestClose}
              className="text-[#999] hover:text-[#0F0F12] transition-colors"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#F0F0F4] px-6 shrink-0">
          {['details', 'candidates'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 mr-5 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#5E6AD2] text-[#5E6AD2]'
                  : 'border-transparent text-[#999] hover:text-[#666]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Success banner */}
          {editSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Changes saved successfully.
            </div>
          )}

          {activeTab === 'details' && (
            isEditing ? (
              /* ── Edit form ──────────────────────────────────────────── */
              <div>
                {editError && (
                  <p className="text-xs text-[#D93025] mb-4">{editError}</p>
                )}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Company</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                      <EditField label="Company name" colSpan2>
                        <input type="text" value={editFields.name || ''} onChange={(e) => setEditField('name', e.target.value)} className={fldCls} />
                      </EditField>
                      <EditField label="Industry">
                        <input type="text" value={editFields.industry || ''} onChange={(e) => setEditField('industry', e.target.value)} className={fldCls} placeholder="e.g. Banking, Healthcare" />
                      </EditField>
                      <EditField label="Client Type">
                        <select value={editFields.client_type || ''} onChange={(e) => setEditField('client_type', e.target.value)} className={fldCls}>
                          <option value="">Select type</option>
                          {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </EditField>
                      <EditField label="Location">
                        <input type="text" value={editFields.location || ''} onChange={(e) => setEditField('location', e.target.value)} className={fldCls} placeholder="City, Country" />
                      </EditField>
                      <EditField label="Website">
                        <input type="url" value={editFields.website || ''} onChange={(e) => setEditField('website', e.target.value)} className={fldCls} placeholder="https://" />
                      </EditField>
                      <EditField label="Account Status">
                        <select value={editFields.account_status || ''} onChange={(e) => setEditField('account_status', e.target.value)} className={fldCls}>
                          {ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </EditField>
                      <EditField label="About" colSpan2>
                        <textarea
                          value={editFields.about || ''}
                          onChange={(e) => setEditField('about', e.target.value)}
                          rows={3}
                          className={`${fldCls} h-auto py-2 resize-none`}
                          placeholder="Company description…"
                        />
                      </EditField>
                    </div>
                  </div>

                  <hr className="border-[#F0F0F4]" />

                  <div>
                    <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Primary Contact</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                      <EditField label="Name">
                        <input type="text" value={editFields.primary_contact_name || ''} onChange={(e) => setEditField('primary_contact_name', e.target.value)} className={fldCls} />
                      </EditField>
                      <EditField label="Designation">
                        <input type="text" value={editFields.primary_contact_designation || ''} onChange={(e) => setEditField('primary_contact_designation', e.target.value)} className={fldCls} />
                      </EditField>
                      <EditField label="Email">
                        <input type="email" value={editFields.primary_contact_email || ''} onChange={(e) => setEditField('primary_contact_email', e.target.value)} className={fldCls} />
                      </EditField>
                      <EditField label="Phone">
                        <input type="tel" value={editFields.primary_contact_phone || ''} onChange={(e) => setEditField('primary_contact_phone', e.target.value)} className={fldCls} />
                      </EditField>
                    </div>
                  </div>

                  <hr className="border-[#F0F0F4]" />

                  <div>
                    <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Notes</h3>
                    <textarea
                      value={editFields.notes || ''}
                      onChange={(e) => setEditField('notes', e.target.value)}
                      rows={4}
                      className={`${fldCls} h-auto py-2 resize-none`}
                      placeholder="Internal notes…"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Read-only details ──────────────────────────────────── */
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Company</h3>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                    <Field label="Industry">{client?.industry}</Field>
                    <Field label="Client Type">{client?.client_type}</Field>
                    <Field label="Location">{client?.location}</Field>
                    <Field label="Website">
                      {client?.website ? (
                        <a
                          href={client.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#5E6AD2] hover:underline truncate block max-w-full"
                        >
                          {client.website}
                        </a>
                      ) : null}
                    </Field>
                    <Field label="Account Status">{client?.account_status}</Field>
                    <Field label="Added">{formatDate(client?.created_at)}</Field>
                    {client?.about && (
                      <Field label="About" colSpan2>{client.about}</Field>
                    )}
                  </dl>
                </div>

                <hr className="border-[#F0F0F4]" />

                <div>
                  <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">Primary Contact</h3>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                    <Field label="Name">{client?.primary_contact_name}</Field>
                    <Field label="Designation">{client?.primary_contact_designation}</Field>
                    <Field label="Email">{client?.primary_contact_email}</Field>
                    <Field label="Phone">{client?.primary_contact_phone}</Field>
                  </dl>
                </div>

                {client?.notes && (
                  <>
                    <hr className="border-[#F0F0F4]" />
                    <div>
                      <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">Notes</h3>
                      <p className="text-sm text-[#666] leading-relaxed whitespace-pre-wrap">{client.notes}</p>
                    </div>
                  </>
                )}
              </div>
            )
          )}

          {activeTab === 'candidates' && client && (
            <LinkedCandidates clientId={client.id} />
          )}
        </div>
      </div>

      {/* Unsaved changes dialog */}
      {dialog && (
        <UnsavedChangesModal
          message={dialog.message}
          onSave={dialog.onSave}
          onDiscard={dialog.onDiscard}
          onCancel={dialog.onCancel}
          saving={dialogSaving}
        />
      )}
    </>
  )
}
