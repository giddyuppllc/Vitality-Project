/**
 * <input type="datetime-local"> gives "YYYY-MM-DDTHH:mm" with NO zone. Sent
 * as-is, the server's `new Date()` read it as UTC — an admin's 10:00 was saved
 * as 10:00Z (hours off), and the edit form prefilled with toISOString() (UTC)
 * so the time drifted again on every save. These convert in the BROWSER's
 * zone, which is what the admin typed. Client-side only.
 */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value) // browsers parse zone-less date-time as local
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function isoToLocalInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
