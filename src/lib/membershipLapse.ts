/**
 * What happens when a membership's renewal invoice goes unpaid.
 *
 * THE GAP THIS FILLS
 * Before this, nothing moved a membership out of ACTIVE. Status only ever went
 * TO ACTIVE, on mark-paid. A member whose invoice went unpaid stayed ACTIVE
 * indefinitely, kept the tier discount / free shipping / peptide credits, and
 * was never even re-invoiced — membership-monthly skips anyone already holding
 * an UNPAID invoice. Two live members sat 43 and 49 days past renewal that way.
 *
 * THE POLICY
 *   renewsAt passes        the member is overdue but KEEPS everything
 *   ...through the grace   escalating reminders on the days below
 *   grace expires          status -> PAST_DUE, benefits stop
 *
 * Payment is Zelle — a human sends a transfer and an admin marks it paid — so
 * the grace is deliberately generous. A card decline can be retried in seconds;
 * a bank transfer over a weekend cannot.
 *
 * Suspension is NOT cancellation. The row keeps its tier and history, so
 * mark-paid flips it straight back to ACTIVE with a fresh cycle. Nothing here
 * deletes or downgrades a tier.
 *
 * WHY BENEFITS ACTUALLY STOP: getUserMembership() resolves tier to 'NONE'
 * unless status === 'ACTIVE', and pricing/checkout gate credits and free
 * supplies on the same check. One status flip suspends all of it — there is no
 * second place to remember.
 */

/** Days past renewsAt before benefits are suspended. */
export const GRACE_DAYS = 14

/** Days past renewsAt on which a reminder goes out, while still in grace. */
export const REMINDER_DAYS_OVERDUE = [1, 5, 10] as const

/** Don't send two notices within this many hours, whatever the schedule says. */
export const MIN_HOURS_BETWEEN_NOTICES = 20

export type LapseAction =
  | { action: 'none'; reason: string }
  | { action: 'remind'; daysOverdue: number; daysLeftInGrace: number }
  | { action: 'suspend'; daysOverdue: number }

export interface LapseInput {
  status: string
  tier: string
  renewsAt: Date | null
  /** Whether the invoice for this cycle is still unpaid. */
  invoiceUnpaid: boolean
  lastOverdueNoticeAt: Date | null
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

/**
 * Decide what a single membership needs. Pure — no clock, no database — so the
 * policy can be exercised against fixed dates instead of waiting for one.
 */
export function assessMembership(m: LapseInput, now: Date): LapseAction {
  if (m.status !== 'ACTIVE') return { action: 'none', reason: `status is ${m.status}` }
  if (m.tier === 'NONE') return { action: 'none', reason: 'free tier has nothing to renew' }
  if (!m.renewsAt) return { action: 'none', reason: 'no renewal date set' }

  const daysOverdue = daysBetween(now, m.renewsAt)
  if (daysOverdue < 1) return { action: 'none', reason: 'not yet overdue' }

  // Paid, but the renewal date has not been pushed forward yet — leave it be
  // rather than chasing someone who already sent the money.
  if (!m.invoiceUnpaid) return { action: 'none', reason: 'invoice is not unpaid' }

  if (daysOverdue >= GRACE_DAYS) return { action: 'suspend', daysOverdue }

  // Rate limit first: a retry, a redeploy, or two runs in a day must not
  // produce two emails.
  if (m.lastOverdueNoticeAt) {
    const hours = (now.getTime() - m.lastOverdueNoticeAt.getTime()) / 3600000
    if (hours < MIN_HOURS_BETWEEN_NOTICES) {
      return { action: 'none', reason: `notice sent ${Math.round(hours)}h ago` }
    }
  }

  // Send on a scheduled day, or on any later day if that day's run was missed
  // (the cron has never been scheduled here, so catching up matters more than
  // hitting the exact day).
  const due = REMINDER_DAYS_OVERDUE.some(d => daysOverdue >= d)
  if (!due) return { action: 'none', reason: `day ${daysOverdue} is not a reminder day` }

  // Already reminded since the last scheduled day passed? Wait for the next.
  const lastNotice = m.lastOverdueNoticeAt
  const renewsAt = m.renewsAt
  if (lastNotice) {
    const dayOfLastNotice = daysBetween(lastNotice, renewsAt)
    const nextDay = REMINDER_DAYS_OVERDUE.find(d => d > dayOfLastNotice)
    // Past the last scheduled day there is nothing left to say — the only
    // remaining event is suspension. Without this the schedule runs out and
    // every subsequent daily run sends another reminder: days 11, 12 and 13
    // each produced an email, six in total instead of three.
    if (nextDay === undefined) {
      return { action: 'none', reason: 'all scheduled reminders sent; awaiting suspension' }
    }
    if (daysOverdue < nextDay) {
      return { action: 'none', reason: `next reminder at day ${nextDay}` }
    }
  }

  return { action: 'remind', daysOverdue, daysLeftInGrace: GRACE_DAYS - daysOverdue }
}
