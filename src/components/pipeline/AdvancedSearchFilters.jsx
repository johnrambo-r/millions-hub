import { QUALIFICATIONS } from '../../lib/candidateConstants'

const inputCls =
  'h-9 rounded-lg border border-[#F0F0F4] bg-white px-3 text-sm text-[#0F0F12] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition w-full'

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[#666]">{label}</span>
      {children}
    </label>
  )
}

// Keyword + structured filters for Advanced Search (useCandidateFilterSearch /
// search_candidates_by_filters). All fields optional and combinable — filters is a flat object
// the parent owns, onChange(key, value) updates one field at a time.
export default function AdvancedSearchFilters({ filters, onChange }) {
  return (
    <div className="px-4 sm:px-6 py-4 border-b border-[#F0F0F4] bg-white shrink-0 space-y-3">
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
          value={filters.keyword}
          onChange={(e) => onChange('keyword', e.target.value)}
          placeholder='Keyword in resume… e.g. "data engineer" or "Kafka -junior"'
          className={`${inputCls} h-10 pl-8`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Field label="Min experience (yrs)">
          <input
            type="number" min={0} step={0.5}
            value={filters.expMin}
            onChange={(e) => onChange('expMin', e.target.value)}
            placeholder="Any"
            className={inputCls}
          />
        </Field>
        <Field label="Max experience (yrs)">
          <input
            type="number" min={0} step={0.5}
            value={filters.expMax}
            onChange={(e) => onChange('expMax', e.target.value)}
            placeholder="Any"
            className={inputCls}
          />
        </Field>
        <Field label="Location">
          <input
            type="text"
            value={filters.location}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="e.g. Bangalore"
            className={inputCls}
          />
        </Field>
        <Field label="Company">
          <input
            type="text"
            value={filters.company}
            onChange={(e) => onChange('company', e.target.value)}
            placeholder="Current employer"
            className={inputCls}
          />
        </Field>
        <Field label="Education">
          <select
            value={filters.education}
            onChange={(e) => onChange('education', e.target.value)}
            className={inputCls}
          >
            <option value="">Any</option>
            {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </Field>
        <Field label="Added after">
          <input
            type="date"
            value={filters.addedAfter}
            onChange={(e) => onChange('addedAfter', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Added before">
          <input
            type="date"
            value={filters.addedBefore}
            onChange={(e) => onChange('addedBefore', e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  )
}
