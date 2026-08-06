import BottomSheet from './BottomSheet'

// Large-tap-target option list for editing Stage/Status on mobile — this
// changes real data, so rows are generously sized (py-4, text-base) rather
// than a small compact popup.
export default function StageStatusSheet({ title, value, options, onSelect, onClose }) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="py-2">
        {options.length === 0 && (
          <p className="px-5 py-4 text-sm text-[#999]">No options available</p>
        )}
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { onSelect(opt); onClose() }}
            className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-base text-left transition-colors ${
              opt === value ? 'text-[#5E6AD2] font-semibold bg-[#5E6AD2]/5' : 'text-[#0F0F12] active:bg-[#F5F5F8]'
            }`}
          >
            <span className="truncate">{opt}</span>
            {opt === value && (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 shrink-0">
                <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
