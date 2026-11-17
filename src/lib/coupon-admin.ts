/**
 * The coupon form's "Expires" box is a plain date (YYYY-MM-DD). `new Date()`
 * of that is UTC MIDNIGHT at the start of the day, and the validator rejects
 * once expiresAt < now — so a coupon set to expire 12/31 stopped working on the
 * afternoon of 12/30 in US time. A date-only value now means "through the end
 * of that day" (23:59:59.999 UTC), which keeps the same calendar date wherever
 * it is displayed (form, list, CSV). Full timestamps pass through unchanged.
 */
export function couponExpiryFromInput(v: string | null | undefined): Date | null {
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T23:59:59.999Z`)
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export { zodMessage } from './zod-message'
