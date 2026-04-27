export default function FormSection({ title, children }) {
  return (
    <div className="border border-[#F0F0F4] rounded-xl overflow-hidden">
      <div className="px-6 py-3.5 border-b border-[#F0F0F4] bg-[#FAFAFA]">
        <h2 className="text-xs font-semibold text-[#666] uppercase tracking-wider">{title}</h2>
      </div>
      <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-5">
        {children}
      </div>
    </div>
  )
}
