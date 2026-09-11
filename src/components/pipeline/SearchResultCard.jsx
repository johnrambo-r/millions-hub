// Card used in the Talent Search results grid (Advanced Search + Smart Search). Distinct from
// CandidateCard (src/components/pipeline/CandidateCard.jsx), which is the shared mobile-row
// component used across Pipeline/MandatePanel/MandateList/Dashboard — this one is search-results-
// specific and always renders as a grid card (1 col on mobile, up to 4 on wide desktop; the
// column count is driven by the grid wrapper in TalentSearch.jsx, not by this component).
const MAX_TAGS = 4

// skill_role is a single free-text field (see AddCandidate.jsx's "Skill / Role" input) that often
// holds more than one skill/title separated by a delimiter, e.g. "React, Node.js, AWS". Splitting
// it client-side is a stand-in for the future dedicated skills array (see build brief) — it ships
// tags now using only what's already in the schema.
function parseSkillTags(skillRole) {
  if (!skillRole) return []
  const parts = skillRole
    .split(/\s*(?:,|\/|;|\||&|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set()
  const tags = []
  for (const p of parts) {
    const key = p.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(p)
  }
  return tags
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 shrink-0">
      <path d="M8 14.5s5-4.2 5-8.2a5 5 0 1 0-10 0c0 4 5 8.2 5 8.2Z" strokeLinejoin="round" />
      <circle cx="8" cy="6.3" r="1.8" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 shrink-0">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8V8l2.3 1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 shrink-0">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M2 4.5l6 4.5 6-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 shrink-0">
      <path d="M3.5 2h2l1 3-1.5 1.2a8 8 0 0 0 4.8 4.8L11 9.5l3 1v2a1.5 1.5 0 0 1-1.6 1.5A11 11 0 0 1 2 3.6 1.5 1.5 0 0 1 3.5 2Z" strokeLinejoin="round" />
    </svg>
  )
}

// matchPercent: pass a 0–1 similarity score to show the "N% match" badge (Smart Search only);
// omit/null on Advanced Search results, which have no similarity score — never render an empty
// badge in that case.
export default function SearchResultCard({
  onClick, name, location, experience, skillRole, email, phone, matchPercent,
}) {
  const tags = parseSkillTags(skillRole)
  const shownTags = tags.slice(0, MAX_TAGS)
  const extraCount = tags.length - shownTags.length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="relative flex flex-col rounded-xl border border-[#F0F0F4] bg-white p-4 hover:border-[#5E6AD2]/40 hover:shadow-sm transition-all cursor-pointer h-full"
    >
      {matchPercent != null && (
        <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5">
          {Math.round(matchPercent * 100)}% match
        </span>
      )}

      <div className="flex items-start gap-3 pr-20">
        <div className="w-10 h-10 rounded-full bg-[#5E6AD2] flex items-center justify-center text-white text-sm font-semibold select-none shrink-0">
          {getInitials(name)}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[#0F0F12] text-sm truncate">{name ?? '—'}</p>
          <p className="text-xs text-[#666] mt-0.5 truncate">{skillRole || '—'}</p>
        </div>
      </div>

      {(location || experience != null) && (
        <div className="flex items-center gap-3 mt-3 text-xs text-[#999]">
          {location && (
            <span className="flex items-center gap-1 min-w-0 truncate"><PinIcon />{location}</span>
          )}
          {experience != null && (
            <span className="flex items-center gap-1 shrink-0"><ClockIcon />{experience} yrs exp</span>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {shownTags.map((tag, i) => (
            <span key={i} className="inline-flex items-center rounded-md bg-[#F5F5F8] text-[#666] text-xs px-2 py-0.5 truncate max-w-[140px]">
              {tag}
            </span>
          ))}
          {extraCount > 0 && (
            <span className="inline-flex items-center rounded-md bg-[#F5F5F8] text-[#999] text-xs px-2 py-0.5">
              +{extraCount}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-[#F0F0F4]">
        <div className="min-w-0 flex-1">
          {email ? (
            <span className="flex items-center gap-1.5 text-xs text-[#666] truncate"><MailIcon />{email}</span>
          ) : phone ? (
            <span className="flex items-center gap-1.5 text-xs text-[#666] truncate"><PhoneIcon />{phone}</span>
          ) : (
            <span className="text-xs text-[#999]">—</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick() }}
          className="shrink-0 h-7 px-3 rounded-lg text-xs font-medium border border-[#F0F0F4] text-[#5E6AD2] hover:border-[#5E6AD2] hover:bg-[#5E6AD2]/5 transition"
        >
          View profile
        </button>
      </div>
    </div>
  )
}
