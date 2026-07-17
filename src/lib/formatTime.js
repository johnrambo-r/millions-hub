// Formats a 24-hour "HH:MM" / "HH:MM:SS" DB time string as 12-hour with AM/PM,
// e.g. "13:00:00" -> "01:00 PM". Display-only — does not touch stored values.
export function formatTime12h(str) {
  if (!str) return ''
  const [h, m] = str.split(':').map(Number)
  if (isNaN(h)) return str
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${String(hour12).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')} ${period}`
}
