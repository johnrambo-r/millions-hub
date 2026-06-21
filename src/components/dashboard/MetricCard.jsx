export default function MetricCard({ label, value, accent, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#FAFAFA] border rounded-xl p-5 flex flex-col gap-1 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-white' : ''
      } ${
        selected
          ? 'border-[#5E6AD2] ring-2 ring-[#5E6AD2]/20 bg-white'
          : 'border-[#F0F0F4]'
      }`}
    >
      <span className="text-xs font-medium text-[#999]">{label}</span>
      <span
        className="text-3xl font-bold tracking-tight"
        style={{ color: accent ?? '#0F0F12' }}
      >
        {value ?? '—'}
      </span>
    </div>
  )
}
