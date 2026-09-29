/**
 * Small time-zone helpers (no dependency): local wall-clock parts of an
 * instant in an IANA zone, and the reverse (wall clock in a zone → instant).
 * Used for monthly event series and email timestamps.
 */

export interface ZonedParts {
  year: number
  month: number // 1–12
  day: number
  hour: number
  minute: number
  weekday: number // 0 = Sunday
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function zonedParts(at: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: WEEKDAYS.indexOf(get('weekday')),
  }
}

/** Offset (ms) of `timeZone` from UTC at instant `at`. */
function offsetAt(at: Date, timeZone: string): number {
  const z = zonedParts(at, timeZone)
  const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute)
  return asUtc - Math.floor(at.getTime() / 60000) * 60000
}

/** The instant at which the wall clock in `timeZone` reads the given time. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  let t = guess - offsetAt(new Date(guess), timeZone)
  // Second pass settles DST boundaries.
  t = guess - offsetAt(new Date(t), timeZone)
  return new Date(t)
}

/**
 * Same weekday-of-month, same local time, next month. "3rd Thursday 7:00 pm"
 * stays "3rd Thursday 7:00 pm" across DST. A 5th-weekday date that the next
 * month lacks falls back to that month's last such weekday.
 */
export function nextMonthlyOccurrence(from: Date, timeZone: string): Date {
  const z = zonedParts(from, timeZone)
  const nth = Math.ceil(z.day / 7)
  const y = z.month === 12 ? z.year + 1 : z.year
  const m = z.month === 12 ? 1 : z.month + 1
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  let day = 1 + ((z.weekday - firstWeekday + 7) % 7) + (nth - 1) * 7
  if (day > daysInMonth) day -= 7
  return zonedTimeToUtc(y, m, day, z.hour, z.minute, timeZone)
}

/** Add whole calendar months in UTC (clamped to month end). */
export function addUtcMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + months
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(
    Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()),
  )
}
