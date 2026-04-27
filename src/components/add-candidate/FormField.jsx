// Shared input className builder — import and use in form pages
export function inputCls(error) {
  return [
    'h-9 w-full rounded-lg border px-3 text-sm text-[#0F0F12]',
    'placeholder-[#999] bg-white focus:outline-none focus:ring-2 transition',
    error
      ? 'border-[#D93025] focus:ring-[#D93025]/20 focus:border-[#D93025]'
      : 'border-[#F0F0F4] focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]',
  ].join(' ')
}

export const inputReadOnly =
  'h-9 w-full rounded-lg border border-[#F0F0F4] px-3 text-sm text-[#999] bg-[#FAFAFA] cursor-not-allowed select-none'

export default function FormField({ label, required, error, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[#666] mb-1.5">
        {label}
        {required && <span className="text-[#D93025] ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-[#D93025]" data-field-error="true">{error}</p>
      )}
    </div>
  )
}
