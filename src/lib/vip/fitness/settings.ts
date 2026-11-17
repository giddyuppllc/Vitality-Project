import { prisma } from '@/lib/prisma'

/**
 * Admin-editable points for fitness & health activity. Same mechanism as the
 * clubhouse settings (lib/vip/settings.ts): rows in the shared `site_settings`
 * key/value table, code defaults until an admin saves. 0 turns an award off.
 * Edited at /admin/vip/fitness.
 */
export const FITNESS_POINT_DEFAULTS = {
  /** A finished workout (at most one award per member per local day). */
  'vip.fitness.points.workout': 25,
  /** A daily check-in. */
  'vip.fitness.points.checkin': 5,
  /** Each completed 7-day check-in streak. */
  'vip.fitness.points.streak7': 100,
  /** Finishing every day of a program. */
  'vip.fitness.points.programComplete': 500,
} as const

export type FitnessPointKey = keyof typeof FITNESS_POINT_DEFAULTS
export type FitnessPoints = Record<FitnessPointKey, number>
export const FITNESS_POINT_KEYS = Object.keys(FITNESS_POINT_DEFAULTS) as FitnessPointKey[]

export const FITNESS_POINT_LABELS: Record<FitnessPointKey, string> = {
  'vip.fitness.points.workout': 'Workout logged (max once a day)',
  'vip.fitness.points.checkin': 'Daily check-in',
  'vip.fitness.points.streak7': '7-day check-in streak',
  'vip.fitness.points.programComplete': 'Program completed',
}

export const MAX_POINTS_SETTING = 100_000

function coerce(key: FitnessPointKey, raw: string | undefined): number {
  if (raw === undefined) return FITNESS_POINT_DEFAULTS[key]
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 && n <= MAX_POINTS_SETTING ? n : FITNESS_POINT_DEFAULTS[key]
}

export async function getFitnessPoints(): Promise<FitnessPoints> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: FITNESS_POINT_KEYS } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as FitnessPoints
  for (const k of FITNESS_POINT_KEYS) out[k] = coerce(k, map.get(k))
  return out
}

export async function setFitnessPoints(values: Partial<FitnessPoints>): Promise<void> {
  for (const k of FITNESS_POINT_KEYS) {
    const v = values[k]
    if (v === undefined) continue
    await prisma.siteSetting.upsert({ where: { key: k }, update: { value: String(v) }, create: { key: k, value: String(v) } })
  }
}
