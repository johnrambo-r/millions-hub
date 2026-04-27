function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4 text-emerald-400 shrink-0">
      <path d="M3 8l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
      <path d="M4 4l8 8M12 4L4 12" strokeLinecap="round" />
    </svg>
  )
}

export default function SuccessToast({ candidateId, onDismiss }) {
  if (!candidateId) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-xl"
      style={{ backgroundColor: '#0F0F12' }}>
      <CheckIcon />
      <span className="text-sm font-medium text-white">
        {candidateId} added successfully
      </span>
      <button
        onClick={onDismiss}
        className="text-white/40 hover:text-white transition ml-1"
        aria-label="Dismiss"
      >
        <CloseIcon />
      </button>
    </div>
  )
}
