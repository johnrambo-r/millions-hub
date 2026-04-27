function Badge({ label, color }) {
  const styles = {
    red: 'bg-red-50 text-[#D93025] border-red-100',
    amber: 'bg-amber-50 text-[#B45309] border-amber-100',
    indigo: 'bg-indigo-50 text-[#5E6AD2] border-indigo-100',
    green: 'bg-emerald-50 text-[#1D8A5E] border-emerald-100',
  }
  return (
    <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${styles[color] ?? styles.indigo}`}>
      {label}
    </span>
  )
}

export default function CandidateRow({ candidate, badgeLabel, badgeColor, daysOverdue, onClick }) {
  const clientName = candidate.clients?.name ?? '—'

  return (
    <button
      onClick={() => onClick?.(candidate)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition-colors text-left border-b border-[#F0F0F4] last:border-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F0F12] truncate">{candidate.name}</p>
        <p className="text-xs text-[#999] truncate">{candidate.skill_role} · {clientName}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {badgeLabel && <Badge label={badgeLabel} color={badgeColor} />}
        {daysOverdue != null && (
          <span className="text-xs text-[#D93025] font-medium whitespace-nowrap">{daysOverdue}d</span>
        )}
      </div>
    </button>
  )
}
