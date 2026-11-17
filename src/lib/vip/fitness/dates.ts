import { zonedParts } from '@/lib/vip/time'

/**
 * Member-local calendar dates ("YYYY-MM-DD") and streak math. Pure.
 *
 * A check-in, a body-metric entry or a finished workout belongs to the day
 * on the MEMBER's wall clock (their own IANA zone, lib/vip/time.ts), never
 * the server's or UTC — 11pm in Los Angeles is still "today" for them.
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** The local calendar date of instant `at` in `timeZone`. */
export function localDate(at: Date, timeZone: string): string {
  const z = zonedParts(at, timeZone)
  return `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** Calendar arithmetic on a "YYYY-MM-DD" (no time zone involved). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((tb - ta) / 86400e3)
}

/** The `n` dates ending on `end` (inclusive), oldest first. */
export function lastNDates(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))
}

/** "Mon, Nov 17" for a local date (rendered in UTC so it never shifts). */
export function fmtDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
}

/** Run of consecutive dates in `set` that contains `day` → [start, end], or null. */
export function runContaining(set: ReadonlySet<string>, day: string): [string, string] | null {
  if (!set.has(day)) return null
  let start = day
  while (set.has(addDays(start, -1))) start = addDays(start, -1)
  let end = day
  while (set.has(addDays(end, 1))) end = addDays(end, 1)
  return [start, end]
}

/**
 * Current streak as of `today`: the run ending today, or — if today has no
 * check-in yet — the run ending yesterday (the streak is still alive until
 * the day is over). 0 when neither day is checked in.
 */
export function currentStreak(set: ReadonlySet<string>, today: string): number {
  let day = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(day)) {
    n += 1
    day = addDays(day, -1)
  }
  return n
}

/** Longest run of consecutive dates within [from, to] (inclusive). */
export function longestRun(dates: Iterable<string>, from?: string, to?: string): number {
  const sorted = [...new Set(dates)].filter((d) => (!from || d >= from) && (!to || d <= to)).sort()
  let best = 0
  let cur = 0
  let prev: string | null = null
  for (const d of sorted) {
    cur = prev && daysBetween(prev, d) === 1 ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = d
  }
  return best
}

/**
 * 7-day streak blocks completed by the run that contains `day`. A run of 7
 * consecutive days is one block; 14 is two (the second block starts on day
 * 8), and so on. Each block is identified by its first date — that date is
 * the "weekStartDate" in the exactly-once award key, so a block is paid at
 * most once no matter how often the member edits a check-in inside it.
 */
export function completedSevenDayBlocks(set: ReadonlySet<string>, day: string): string[] {
  const run = runContaining(set, day)
  if (!run) return []
  const [start, end] = run
  const len = daysBetween(start, end) + 1
  return Array.from({ length: Math.floor(len / 7) }, (_, k) => addDays(start, k * 7))
}
