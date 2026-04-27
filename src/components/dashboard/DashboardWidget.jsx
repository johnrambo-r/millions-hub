export default function DashboardWidget({ title, children, empty }) {
  return (
    <div className="bg-white border border-[#F0F0F4] rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#F0F0F4]">
        <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <p className="text-sm text-[#999] text-center py-8">No items</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
