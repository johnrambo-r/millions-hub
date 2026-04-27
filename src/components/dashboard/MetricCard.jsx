export default function MetricCard({ label, value, accent }) {
  return (
    <div className="bg-[#FAFAFA] border border-[#F0F0F4] rounded-xl p-5 flex flex-col gap-1">
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
