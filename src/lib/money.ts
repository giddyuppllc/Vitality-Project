/**
 * Money typed by a human → cents.
 *
 * WHY THIS IS A SHARED HELPER
 * The expression `Math.round(parseFloat(v) * 100)` was written out at fifteen-
 * plus call sites — product price, compare price, sale price, shipping rates,
 * coupon values, discount minimums, facility cost, customer credits, lead value
 * — and it has two failure modes at every one of them:
 *
 *   "$64"    → NaN → JSON.stringify writes NULL → a Zod z.number() rejects it
 *              → 400 → and admin forms that swallow the response show nothing.
 *   "1,200"  → parseFloat stops at the comma → 100 → SAVES $1.00 INSTEAD OF
 *              $1,200.00, with no error anywhere.
 *
 * The second is the dangerous one. A price box that accepts a comma and quietly
 * stores a hundredth of the value will not be noticed until someone reconciles
 * takings — and on a coupon minimum or a shipping rate, not even then.
 *
 * Currency symbols, thousands separators and stray spaces are what people
 * actually type into a money box, so strip them rather than punish them.
 */
export function parseMoneyToCents(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null
  }
  const cleaned = String(raw ?? '').replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/**
 * Same parse for a whole-number field (quantities, percentages, day counts).
 * Returns null rather than NaN so callers must decide what a bad value means.
 */
export function parseIntStrict(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.trunc(raw) : null
  const cleaned = String(raw ?? '').replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.trunc(n) : null
}
