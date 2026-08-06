import { createPortal } from 'react-dom'

// Generic mobile bottom-sheet shell: backdrop + slide-up panel, portaled into
// document.body so it can't be clipped by a scrolling/overflow ancestor (the
// same class of bug fixed for the filter pill dropdowns). Sits at z-[70],
// above CandidatePanel's z-50, matching StagePromptModal's existing level
// since both can be triggered from inside the panel.
//
// stopPropagation on the outer wrapper mirrors StagePromptModal's existing
// convention — without it, clicks on sheet content would still bubble up
// through the React tree to whatever opened the sheet (e.g. a candidate
// card's own onClick), since React portals bubble through the component
// tree, not the DOM tree.
export default function BottomSheet({ title, onClose, children }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[70] md:hidden"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F0F0F4] shrink-0">
          <span className="text-sm font-semibold text-[#0F0F12]">{title}</span>
          <button onClick={onClose} className="text-[#999] hover:text-[#0F0F12] transition-colors" aria-label="Close">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  )
}
