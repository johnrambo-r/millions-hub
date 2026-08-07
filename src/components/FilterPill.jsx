import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Mobile-only compact filter control: a pill showing the current selection
// (or its label when unset) that opens a small dropdown anchored below it.
// The dropdown is rendered via a portal into document.body — the pill row
// it lives in scrolls horizontally (overflow-x-auto), which per the CSS
// overflow spec also clips the vertical axis, so an absolutely-positioned
// child anchored inside it gets cut off instead of overlaying the cards
// below. Portaling out to the body sidesteps that clipping ancestor.
export default function FilterPill({ title, value, options, onSelect }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  function openMenu() {
    setRect(btnRef.current?.getBoundingClientRect() ?? null)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function handleScroll(e) {
      // Scrolling the options list itself dispatches a 'scroll' event that
      // this capture-phase listener sees too — ignore that so touch-scrolling
      // through options doesn't close the menu. Only an ancestor (e.g. the
      // horizontally-scrollable pill row) scrolling should close it, since
      // that invalidates the anchor position captured in `rect`.
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function handleKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)
  const shown = selected ? selected.label : title

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`h-8 max-w-[140px] px-3 rounded-full text-xs font-medium whitespace-nowrap truncate border transition shrink-0 ${
          value
            ? 'bg-[#5E6AD2]/10 border-[#5E6AD2]/40 text-[#5E6AD2]'
            : 'bg-white border-[#E0E0E8] text-[#666]'
        }`}
      >
        {shown}
      </button>
      {open && rect && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 bg-white border border-[#E0E0E8] rounded-lg shadow-lg min-w-[170px] max-h-64 overflow-y-auto"
          style={{ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 178)) }}
        >
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(''); setOpen(false) }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F8] transition-colors whitespace-nowrap ${!value ? 'text-[#5E6AD2] font-medium' : 'text-[#666]'}`}
          >
            All {title.toLowerCase()}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F8] transition-colors truncate ${opt.value === value ? 'text-[#5E6AD2] font-medium' : 'text-[#0F0F12]'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
