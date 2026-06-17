import { useState } from 'react'

function getPageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const shown = new Set(
    [1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages)
  )
  const sorted = [...shown].sort((a, b) => a - b)
  const result = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…')
    result.push(sorted[i])
  }
  return result
}

const BTN = 'h-7 min-w-[28px] px-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center'

export default function Pagination({ total, page, perPage = 50, onChange }) {
  const [jumpValue, setJumpValue] = useState('')
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const start = total === 0 ? 0 : (page - 1) * perPage + 1
  const end   = Math.min(page * perPage, total)
  const items = getPageItems(page, totalPages)

  function handleJump(e) {
    if (e.key !== 'Enter') return
    const n = parseInt(jumpValue, 10)
    if (!isNaN(n)) onChange(Math.max(1, Math.min(totalPages, n)))
    setJumpValue('')
  }

  return (
    <div className="px-6 py-3 border-t border-[#F0F0F4] bg-white flex items-center justify-between gap-4 shrink-0">
      <span className="text-xs text-[#999]">{start}–{end} of {total}</span>

      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className={`${BTN} text-[#666] hover:bg-[#F0F0F4] disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Page buttons */}
        {items.map((item, i) =>
          item === '…' ? (
            <span key={`e${i}`} className="text-xs text-[#999] px-1">…</span>
          ) : (
            <button
              key={item}
              onClick={() => onChange(item)}
              className={`${BTN} ${
                item === page
                  ? 'bg-[#5E6AD2] text-white'
                  : 'text-[#666] hover:bg-[#F0F0F4]'
              }`}
            >
              {item}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className={`${BTN} text-[#666] hover:bg-[#F0F0F4] disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Jump to */}
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs text-[#999]">Go to</span>
          <input
            type="text"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={handleJump}
            className="w-12 h-7 text-center text-sm border border-[#F0F0F4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition"
          />
        </div>
      </div>
    </div>
  )
}
