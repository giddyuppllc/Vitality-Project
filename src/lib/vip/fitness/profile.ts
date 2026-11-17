import { prisma } from '@/lib/prisma'
import { getVipSetting } from '@/lib/vip/settings'
import type { Units } from './units'
import { isValidTimeZone, localDate } from './dates'

/**
 * A member's fitness preferences: units (imperial by default), the IANA time
 * zone their browser last reported (falls back to the clubhouse zone,
 * `vip.timeZone`), and whether they hide themselves from leaderboards.
 */
export interface FitnessPrefs {
  units: Units
  timeZone: string
  hasOwnTimeZone: boolean
  hideFromLeaderboards: boolean
}

export async function getFitnessPrefs(userId: string): Promise<FitnessPrefs> {
  const p = await prisma.vipFitnessProfile.findUnique({ where: { userId } })
  const own = p?.timeZone && isValidTimeZone(p.timeZone) ? p.timeZone : null
  return {
    units: p?.units ?? 'IMPERIAL',
    timeZone: own ?? (await getVipSetting('vip.timeZone')),
    hasOwnTimeZone: !!own,
    hideFromLeaderboards: p?.hideFromLeaderboards ?? false,
  }
}

/**
 * Remember the zone the member's browser reports (sent with every check-in,
 * workout and metric write). Invalid zones are ignored, never stored.
 * Returns the zone to use for this request.
 */
export async function resolveTimeZone(userId: string, reported: unknown): Promise<string> {
  if (isValidTimeZone(reported)) {
    await prisma.vipFitnessProfile.upsert({
      where: { userId },
      create: { userId, timeZone: reported },
      update: { timeZone: reported },
    })
    return reported
  }
  return (await getFitnessPrefs(userId)).timeZone
}

export async function updateFitnessPrefs(
  userId: string,
  data: { units?: Units; hideFromLeaderboards?: boolean; timeZone?: string },
): Promise<void> {
  const clean: { units?: Units; hideFromLeaderboards?: boolean; timeZone?: string } = {}
  if (data.units) clean.units = data.units
  if (typeof data.hideFromLeaderboards === 'boolean') clean.hideFromLeaderboards = data.hideFromLeaderboards
  if (isValidTimeZone(data.timeZone)) clean.timeZone = data.timeZone
  await prisma.vipFitnessProfile.upsert({ where: { userId }, create: { userId, ...clean }, update: clean })
}

/** Today on the member's own calendar. */
export function todayIn(timeZone: string, now = new Date()): string {
  return localDate(now, timeZone)
}
