import type { MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Earning rules for the shared points ledger (100 points = $1), editable at
 * /admin/vip/rewards/earning. Stored as integers in the existing
 * `site_settings` key/value table; a missing row means "use the default".
 *
 * Defaults follow the clubhouse plan §9:
 *  - purchases at vitalityproject.global: a 5% base, scaled by membership
 *    tier — The Club 1× (5%), Plus 1.5× (7.5%), Premium Stacks 2× (10%).
 *    Non-members keep the store's long-standing 1 point per $1.
 *  - engagement awards (lessons, courses, first post, events, monthly streak)
 *    are paid by the clubhouse features themselves through lib/vip/points.ts;
 *    the amounts live here so the rewards page shows the live numbers.
 *  - referral: 2,500 points when a referred person's first membership invoice
 *    is paid.
 *  - expiry: the whole balance expires after N months without any points
 *    activity (0 = never).
 *  - redemption cap at .global checkout: points may cover at most N% of an
 *    order's goods after discounts. 0 = no cap (the store's behaviour before
 *    this setting existed).
 */
export const EARNING_DEFAULTS = {
  /** Base points-back on .global purchases, in basis points of the amount paid (500 = 5%). */
  'vip.points.purchaseBaseBps': 500,
  /** Tier multipliers in percent (100 = 1×). */
  'vip.points.multClub': 100,
  'vip.points.multPlus': 150,
  'vip.points.multPremium': 200,
  'vip.points.lesson': 50,
  'vip.points.course': 500,
  'vip.points.firstPost': 100,
  'vip.points.event': 100,
  'vip.points.streak': 100,
  'vip.points.referral': 2500,
  /** Months without points activity before a balance expires. 0 = never. */
  'vip.points.expiryMonths': 12,
  /** Max % of an order's goods (after discounts) payable with points at .global checkout. 0 = no cap. */
  'vip.points.redeemCapPct': 0,
} as const

export type EarningKey = keyof typeof EARNING_DEFAULTS
export type EarningRules = Record<EarningKey, number>
export const EARNING_KEYS = Object.keys(EARNING_DEFAULTS) as EarningKey[]

/** Upper bounds (typo guards) per key. */
export const EARNING_MAX: Record<EarningKey, number> = {
  'vip.points.purchaseBaseBps': 5000,
  'vip.points.multClub': 1000,
  'vip.points.multPlus': 1000,
  'vip.points.multPremium': 1000,
  'vip.points.lesson': 100_000,
  'vip.points.course': 100_000,
  'vip.points.firstPost': 100_000,
  'vip.points.event': 100_000,
  'vip.points.streak': 100_000,
  'vip.points.referral': 1_000_000,
  'vip.points.expiryMonths': 120,
  'vip.points.redeemCapPct': 100,
}

function coerce(key: EarningKey, raw: string | undefined): number {
  if (raw === undefined) return EARNING_DEFAULTS[key]
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 && n <= EARNING_MAX[key] ? n : EARNING_DEFAULTS[key]
}

export async function getEarningRules(): Promise<EarningRules> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: EARNING_KEYS } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as EarningRules
  for (const k of EARNING_KEYS) out[k] = coerce(k, map.get(k))
  return out
}

export async function getEarningRule(key: EarningKey): Promise<number> {
  const row = await prisma.siteSetting.findUnique({ where: { key } })
  return coerce(key, row?.value)
}

export async function setEarningRules(values: Partial<EarningRules>): Promise<void> {
  for (const k of EARNING_KEYS) {
    const v = values[k]
    if (v === undefined) continue
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
