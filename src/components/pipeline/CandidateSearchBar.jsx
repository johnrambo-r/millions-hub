// Natural-language search row for the Candidates screen (src/pages/Pipeline.jsx). Deliberately a
// full-width row of its own between the tab bar and the existing filter bars, rather than living
// inside either — the filter bars already own a per-tab keyword `search` input tied to
// client-side filtering of the current tab's rows; this is a separate, DB-backed semantic search
// across all candidates, and mixing the two inputs would be confusing.
export default function CandidateSearchBar({ value, onChange, loading, resultCount, error }) {
  return (
    <div className="px-4 sm:px-6 py-3 border-b border-[#F0F0F4] bg-white shrink-0">
      <div className="relative max-w-xl">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none"
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <circle cx="6.5" cy="6.5" r="4.5" />
          <path d="M10.5 10.5l3 3" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search resumes by skills, experience, background… e.g. “senior React dev with fintech experience”"
          className="h-9 pl-8 pr-3 rounded-lg border border-[#F0F0F4] bg-white text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-full"
        />
      </div>
      {value.trim() && (
        <p className="mt-1.5 text-xs text-[#999]">
          {loading ? 'Searching…' : error ? <span className="text-[#D93025]">{error}</span> :
            `${resultCount} match${resultCount === 1 ? '' : 'es'}`}
        </p>
      )}
    </div>
  )
}
