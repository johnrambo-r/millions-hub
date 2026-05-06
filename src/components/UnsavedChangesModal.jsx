export default function UnsavedChangesModal({ message, onSave, onDiscard, onCancel, saving = false }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[400px] p-6">
        <h3 className="text-base font-semibold text-[#0F0F12] mb-1.5">You have unsaved changes</h3>
        <p className="text-sm text-[#666] mb-6">{message}</p>
        <div className="flex gap-2 justify-end flex-wrap">
          <button
            onClick={onCancel}
            disabled={saving}
            className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            disabled={saving}
            className="h-9 px-4 rounded-lg text-sm border border-[#F0F0F4] text-[#666] hover:bg-[#F5F5F8] transition disabled:opacity-50"
          >
            Discard Changes
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#5E6AD2' }}
          >
            {saving ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
