import { awardPoints } from './points'
import { getVipSettings } from './settings'
import { zonedParts } from './time'

/**
 * Community engagement points, through the shared ledger (lib/vip/points.ts —
 * exactly-once per idempotency key). Amounts are admin settings
 * (vip.points.firstPost, vip.points.postDay; 0 = off):
 *
 *   first post ever         key first-post:<userId>
 *   posting on a given day  key post-day:<userId>:<yyyy-mm-dd>  (clubhouse
 *                           time zone, vip.timeZone — so "a day" is the
 *                           members' day, not UTC's)
 *
 * A failure here never fails the post that earned it.
 */
export function localDay(at: Date, timeZone: string): string {
  const z = zonedParts(at, timeZone)
  return `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`
}

export async function awardPostPoints(userId: string, at = new Date()): Promise<{ firstPost: number; postDay: number }> {
  const out = { firstPost: 0, postDay: 0 }
  try {
    const settings = await getVipSettings()
    const first = settings['vip.points.firstPost']
    const daily = settings['vip.points.postDay']
    if (first > 0) {
      const r = await awardPoints({
        userId,
        points: first,
        type: 'EARN_ENGAGEMENT',
        description: 'First clubhouse post',
        idempotencyKey: `first-post:${userId}`,
      })
      if (!r.duplicate) out.firstPost = first
    }
    if (daily > 0) {
      const day = localDay(at, settings['vip.timeZone'])
      const r = await awardPoints({
        userId,
        points: daily,
        type: 'EARN_ENGAGEMENT',
        description: 'Posted in the clubhouse',
        idempotencyKey: `post-day:${userId}:${day}`,
      })
      if (!r.duplicate) out.postDay = daily
    }
  } catch (err) {
    console.error('[vip/engagement] post points failed:', err)
  }
  return out
}
