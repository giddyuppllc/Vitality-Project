import { getEarningRules, setEarningRules, type EarningKey } from '@/lib/vip/earning'

/**
 * Fitness points — a thin view over the ONE earning-rules registry
 * (lib/vip/earning.ts, edited at /admin/vip/rewards/earning). The
 * `vip.fitness.points.*` names are the keys the fitness branch used; they
 * are still accepted here (and still read from site_settings as fallbacks by
 * the registry), but the values live under the canonical `vip.points.*` keys.
 */
export const FITNESS_POINT_RULE = {
  /** A finished workout (at most one award per member per local day). */
  'vip.fitness.points.workout': 'vip.points.workout',
  /** A daily check-in. */
  'vip.fitness.points.checkin': 'vip.points.checkin',
  /** Each completed 7-day check-in streak. */
  'vip.fitness.points.streak7': 'vip.points.streak7',
  /** Finishing every day of a program. */
  'vip.fitness.points.programComplete': 'vip.points.program',
} as const satisfies Record<string, EarningKey>

export type FitnessPointKey = keyof typeof FITNESS_POINT_RULE
export type FitnessPoints = Record<FitnessPointKey, number>
export const FITNESS_POINT_KEYS = Object.keys(FITNESS_POINT_RULE) as FitnessPointKey[]

export const MAX_POINTS_SETTING = 100_000

export async function getFitnessPoints(): Promise<FitnessPoints> {
  const rules = await getEarningRules()
  const out = {} as FitnessPoints
  for (const k of FITNESS_POINT_KEYS) out[k] = rules[FITNESS_POINT_RULE[k]]
  return out
}

export async function setFitnessPoints(values: Partial<FitnessPoints>): Promise<void> {
  const mapped: Partial<Record<EarningKey, number>> = {}
  for (const k of FITNESS_POINT_KEYS) if (values[k] !== undefined) mapped[FITNESS_POINT_RULE[k]] = values[k]
  await setEarningRules(mapped)
}
