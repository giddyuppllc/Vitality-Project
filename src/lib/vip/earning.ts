import type { MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * THE earning-rules registry for the shared points ledger (100 points = $1).
 *
 * Every points amount in the ecosystem is read from here — purchases,
 * referrals, the Academy (lessons, quizzes, courses), the community (first
 * post, posting day), fitness (workouts, check-ins, 7-day streaks, programs,
 * the default for new challenges) and live events — so:
 *   - ONE admin page lists and edits every rule: /admin/vip/rewards/earning;
 *   - the member "How to earn" table (lib/vip/points-view.ts) is built from
 *     the same list and the same values, so it can never drift.
 *
 * Storage: integers in the existing `site_settings` key/value table; a
 * missing row means "use the default". Rules that had another key on a
 * feature branch (`legacyKeys`, e.g. academy's `vip.points.lessonComplete`,
 * fitness's `vip.fitness.points.workout`) are still READ as a fallback when
 * the canonical key has no row — no data migration is ever needed. Saving
 * writes the canonical key only.
 *
 * Purchases: a 5% base scaled by membership tier — The Club 1× (5%), Plus
 * 1.5× (7.5%), Premium Stacks 2× (10%); non-members keep the store's 1 point
 * per $1. Expiry: the whole balance after N months without points activity
 * (0 = never). Redemption cap at .global checkout: points may cover at most
 * N% of an order's goods after discounts (0 = no cap).
 */
export type EarningGroup = 'Purchases' | 'Referrals' | 'Academy' | 'Community' | 'Fitness' | 'Events' | 'Balance'
export type EarningUnit = 'pts' | 'bps' | '%' | 'months'

export interface EarningRuleDef {
  key: string
  group: EarningGroup
  /** Admin label. */
  label: string
  /** Admin help line (who pays it, when). */
  help: string
  unit: EarningUnit
  default: number
  /** Upper bound (typo guard). */
  max: number
  /** Older keys still read when the canonical key has no row. */
  legacyKeys?: readonly string[]
  /** Member "How to earn" row label; omitted for knobs that are not an activity. */
  member?: string
  /** Optional member note under the row. */
  memberNote?: string
}

export const EARNING_RULES = [
  { key: 'vip.points.purchaseBaseBps', group: 'Purchases', label: 'Purchase points-back — base rate', unit: 'bps', default: 500, max: 5000, help: 'Basis points of what a member pays at vitalityproject.global (500 = 5%), times the tier multiplier. Non-members always earn 1 point per $1. Once per order, when it is paid.' },
  { key: 'vip.points.multClub', group: 'Purchases', label: 'The Club multiplier', unit: '%', default: 100, max: 1000, help: '100 = 1×.' },
  { key: 'vip.points.multPlus', group: 'Purchases', label: 'Plus multiplier', unit: '%', default: 150, max: 1000, help: '150 = 1.5×.' },
  { key: 'vip.points.multPremium', group: 'Purchases', label: 'Premium Stacks multiplier', unit: '%', default: 200, max: 1000, help: '200 = 2×.' },
  { key: 'vip.points.referral', group: 'Referrals', label: 'Referral', unit: 'pts', default: 2500, max: 1_000_000, help: 'To the referrer, once, when the referred person’s first membership invoice is paid.', member: 'Refer someone who becomes a member' },
  { key: 'vip.points.lesson', group: 'Academy', label: 'Lesson completed', unit: 'pts', default: 50, max: 100_000, legacyKeys: ['vip.points.lessonComplete'], help: 'Once per member per lesson. Un-marking never takes points back; re-marking never pays twice.', member: 'Complete an Academy lesson' },
  { key: 'vip.points.quiz', group: 'Academy', label: 'Module check passed', unit: 'pts', default: 25, max: 100_000, legacyKeys: ['vip.points.quizPassed'], help: 'Once per member per quiz, on the first pass.', member: 'Pass a module check' },
  { key: 'vip.points.course', group: 'Academy', label: 'Course finished', unit: 'pts', default: 500, max: 100_000, legacyKeys: ['vip.points.courseComplete'], help: 'Once per member per course, with the certificate, when every lesson and module check is done.', member: 'Finish a full course' },
  { key: 'vip.points.firstPost', group: 'Community', label: 'First community post', unit: 'pts', default: 100, max: 100_000, help: 'Once per member.', member: 'Your first community post' },
  { key: 'vip.points.postDay', group: 'Community', label: 'Posting day', unit: 'pts', default: 10, max: 100_000, help: 'Once per member per day (clubhouse time zone) they post.', member: 'Post in the community', memberNote: 'Once a day' },
  { key: 'vip.points.workout', group: 'Fitness', label: 'Workout logged', unit: 'pts', default: 25, max: 100_000, legacyKeys: ['vip.fitness.points.workout'], help: 'A finished workout; at most once per member per local day.', member: 'Log a workout', memberNote: 'Once a day' },
  { key: 'vip.points.checkin', group: 'Fitness', label: 'Daily check-in', unit: 'pts', default: 5, max: 100_000, legacyKeys: ['vip.fitness.points.checkin'], help: 'Once per member per local date.', member: 'Daily health check-in' },
  { key: 'vip.points.streak7', group: 'Fitness', label: '7-day check-in streak', unit: 'pts', default: 100, max: 100_000, legacyKeys: ['vip.fitness.points.streak7'], help: 'Each completed block of 7 consecutive check-in days.', member: 'Check in 7 days in a row' },
  { key: 'vip.points.program', group: 'Fitness', label: 'Program completed', unit: 'pts', default: 500, max: 100_000, legacyKeys: ['vip.fitness.points.programComplete'], help: 'Once per member per program, when every day is done.', member: 'Finish a training program' },
  { key: 'vip.points.challengeDefault', group: 'Fitness', label: 'Challenge completed — default', unit: 'pts', default: 200, max: 100_000, help: 'Pre-filled on new challenges; each challenge keeps its own amount (edit it on the challenge).', member: 'Complete a challenge', memberNote: 'Amount shown on each challenge' },
  { key: 'vip.points.event', group: 'Events', label: 'Live session attended', unit: 'pts', default: 100, max: 100_000, help: 'Once per member per session, when they open the join link while it is live.', member: 'Join a live session' },
  { key: 'vip.points.expiryMonths', group: 'Balance', label: 'Expire after inactivity', unit: 'months', default: 12, max: 120, help: 'Whole balance expires after this many months with no points activity. 0 = never.' },
  { key: 'vip.points.redeemCapPct', group: 'Balance', label: 'Checkout redemption cap', unit: '%', default: 0, max: 100, help: 'Max share of an order’s goods payable with points at vitalityproject.global. 0 = no cap (the plan suggests 50).' },
] as const satisfies readonly EarningRuleDef[]

export type EarningKey = (typeof EARNING_RULES)[number]['key']
export type EarningRules = Record<EarningKey, number>
export const EARNING_KEYS = EARNING_RULES.map((r) => r.key) as EarningKey[]
export const EARNING_DEFAULTS = Object.fromEntries(EARNING_RULES.map((r) => [r.key, r.default])) as EarningRules
/** Upper bounds (typo guards) per key. */
export const EARNING_MAX = Object.fromEntries(EARNING_RULES.map((r) => [r.key, r.max])) as EarningRules
export const EARNING_GROUPS: EarningGroup[] = ['Purchases', 'Referrals', 'Academy', 'Community', 'Fitness', 'Events', 'Balance']

const RULE_BY_KEY = new Map<string, EarningRuleDef>(EARNING_RULES.map((r) => [r.key, r]))
/** Canonical key for a canonical or legacy key (null = not an earning rule). */
export function canonicalEarningKey(key: string): EarningKey | null {
  if (RULE_BY_KEY.has(key)) return key as EarningKey
  for (const r of EARNING_RULES as readonly EarningRuleDef[]) if (r.legacyKeys?.includes(key)) return r.key as EarningKey
  return null
}
const ALL_STORED_KEYS = (EARNING_RULES as readonly EarningRuleDef[]).flatMap((r) => [r.key, ...(r.legacyKeys ?? [])])

function parse(key: EarningKey, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 && n <= EARNING_MAX[key] ? n : undefined
}

function resolve(key: EarningKey, map: Map<string, string>): number {
  const def = RULE_BY_KEY.get(key)!
  for (const k of [key, ...(def.legacyKeys ?? [])]) {
    const v = parse(key, map.get(k))
    if (v !== undefined) return v
  }
  return EARNING_DEFAULTS[key]
}

export async function getEarningRules(): Promise<EarningRules> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: ALL_STORED_KEYS } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as EarningRules
  for (const k of EARNING_KEYS) out[k] = resolve(k, map)
  return out
}

export async function getEarningRule(key: EarningKey): Promise<number> {
  const def = RULE_BY_KEY.get(key)!
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: [key, ...(def.legacyKeys ?? [])] } } })
  return resolve(key, new Map(rows.map((r) => [r.key, r.value])))
}

/** Save rules (canonical keys only). Values outside 0..max are ignored. */
export async function setEarningRules(values: Partial<EarningRules>): Promise<void> {
  for (const k of EARNING_KEYS) {
    const v = values[k]
    if (v === undefined || !Number.isInteger(v) || v < 0 || v > EARNING_MAX[k]) continue
    await prisma.siteSetting.upsert({ where: { key: k }, update: { value: String(v) }, create: { key: k, value: String(v) } })
  }
}

/** Tier multiplier in percent (100 = 1×). NONE = not a member → 0 (store rule applies). */
export function tierMultiplierPct(tier: MembershipTier, rules: EarningRules): number {
  if (tier === 'CLUB') return rules['vip.points.multClub']
  if (tier === 'PLUS') return rules['vip.points.multPlus']
  if (tier === 'PREMIUM') return rules['vip.points.multPremium']
  return 0
}

/** Effective points-back for a tier, in basis points of the amount paid. */
export function purchaseRateBps(tier: MembershipTier, rules: EarningRules): number {
  return Math.round((rules['vip.points.purchaseBaseBps'] * tierMultiplierPct(tier, rules)) / 100)
}

/** The store's rule for everyone without an active membership: 1 point per whole $1. */
export function legacyPurchasePoints(paidCents: number): number {
  return Math.max(0, Math.floor(paidCents / 100))
}

/**
 * Points for a paid .global order. Members get the tier-scaled rate (never
 * less than the store's 1 point per $1); everyone else the store's rule.
 * 1 point = 1 cent, so points = cents × rate.
 */
export function purchasePoints(paidCents: number, tier: MembershipTier, rules: EarningRules): number {
  const legacy = legacyPurchasePoints(paidCents)
  if (tier === 'NONE' || paidCents <= 0) return legacy
  const tiered = Math.floor((paidCents * purchaseRateBps(tier, rules)) / 10_000)
  return Math.max(legacy, tiered)
}

/** Points a partner purchase earns: `earnPointsPerDollar` per $1 (pro rata to the cent). */
export function partnerEarnPoints(amountCents: number, earnPointsPerDollar: number): number {
  return Math.max(0, Math.floor((amountCents * earnPointsPerDollar) / 100))
}

/** "1.5×" */
export function formatMultiplier(pct: number): string {
  const x = pct / 100
  return `${Number.isInteger(x) ? x.toFixed(0) : String(Number(x.toFixed(2)))}×`
}

/** "7.5%" from basis points. */
export function formatBps(bps: number): string {
  const p = bps / 100
  return `${Number.isInteger(p) ? p.toFixed(0) : String(Number(p.toFixed(2)))}%`
}
