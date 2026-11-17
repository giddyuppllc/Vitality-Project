import { Prisma, type LoyaltyTxType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { periodFor } from './rewards'

/**
 * Rewards badges + the monthly points leaderboard.
 *
 * Badges live in the shared VipUserBadge table (UNIQUE userId+badgeKey, so an
 * award is exactly-once; other clubhouse features award their own keys into
 * it). The rewards milestones are re-checked after every redemption and
 * partner visit, and whenever the member opens their rewards page — so points
 * earned anywhere (lessons, workouts, purchases) still unlock them.
 */

export const REWARD_BADGES = [
  { key: 'rewards.first_redemption', label: 'First reward redeemed', hint: 'Redeem any reward.' },
  { key: 'rewards.points_10k', label: '10,000 points earned', hint: 'Earn 10,000 points in total.' },
  { key: 'rewards.partner_first', label: 'First partner visit', hint: 'Earn or spend points at a partner business.' },
  { key: 'rewards.partner_regular', label: 'Partner regular', hint: 'Five visits to partner businesses.' },
  { key: 'rewards.partner_explorer', label: 'Network explorer', hint: 'Visit three different partner businesses.' },
] as const

export type RewardBadgeKey = (typeof REWARD_BADGES)[number]['key']

/** Ledger types that count as EARNING (not refunds, not admin corrections). */
export const EARNED_TYPES: LoyaltyTxType[] = [
  'EARN_PURCHASE',
  'EARN_REFERRAL',
  'EARN_REVIEW',
  'EARN_BIRTHDAY',
  'EARN_ENGAGEMENT',
  'EARN_PARTNER',
]

/** Reversals of an earlier award (a voided partner purchase) carry this key prefix. */
export const EARN_REVERSAL_PREFIX = 'reverse-earn:'

/** Lifetime points earned (earn lines minus reversed earns). */
export async function lifetimeEarned(userId: string): Promise<number> {
  const acct = await prisma.loyaltyAccount.findUnique({ where: { userId }, select: { id: true } })
  if (!acct) return 0
  const [earned, reversed] = await Promise.all([
    prisma.loyaltyTransaction.aggregate({ where: { accountId: acct.id, type: { in: EARNED_TYPES }, points: { gt: 0 } }, _sum: { points: true } }),
    prisma.loyaltyTransaction.aggregate({
      where: { accountId: acct.id, type: 'REVERSAL', idempotencyKey: { startsWith: EARN_REVERSAL_PREFIX } },
      _sum: { points: true },
    }),
  ])
  return (earned._sum.points ?? 0) + (reversed._sum.points ?? 0)
}

/** Award a badge once. Returns true when newly awarded. */
export async function awardBadge(userId: string, badgeKey: string, label: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO vip_user_badges (id, "userId", "badgeKey", label, "awardedAt")
    VALUES (${`bdg_${crypto.randomUUID()}`}, ${userId}, ${badgeKey}, ${label}, now())
    ON CONFLICT ("userId", "badgeKey") DO NOTHING
    RETURNING id`
  return rows.length > 0
}

/** Check every rewards milestone for a member; award what is newly met. */
export async function evaluateBadges(userId: string): Promise<string[]> {
  const have = new Set((await prisma.vipUserBadge.findMany({ where: { userId }, select: { badgeKey: true } })).map((b) => b.badgeKey))
  const todo = REWARD_BADGES.filter((b) => !have.has(b.key))
  if (!todo.length) return []
  const [redemptions, earned, visits] = await Promise.all([
    prisma.vipRedemption.count({ where: { userId, status: { not: 'CANCELLED' } } }),
    lifetimeEarned(userId),
    prisma.vipPartnerTxn.findMany({ where: { memberUserId: userId, voidedAt: null }, select: { partnerId: true } }),
  ])
  const distinctPartners = new Set(visits.map((v) => v.partnerId)).size
  const met: Record<RewardBadgeKey, boolean> = {
    'rewards.first_redemption': redemptions >= 1,
    'rewards.points_10k': earned >= 10_000,
    'rewards.partner_first': visits.length >= 1,
    'rewards.partner_regular': visits.length >= 5,
    'rewards.partner_explorer': distinctPartners >= 3,
  }
  const awarded: string[] = []
  for (const b of todo) {
    if (met[b.key] && (await awardBadge(userId, b.key, b.label))) awarded.push(b.key)
  }
  return awarded
}

export interface LeaderboardRow {
  userId: string
  points: number
  rank: number
  displayName: string
  avatarUrl: string | null
}

/**
 * Points EARNED in a UTC month (purchases, clubhouse activity, partners,
 * referrals; voided partner awards subtracted; spending never lowers a score).
 * Members who chose "hide me from leaderboards", community-suspended members
 * and people without an active membership are never listed.
 */
export async function monthlyLeaderboard(opts: { period?: string; limit?: number } = {}): Promise<LeaderboardRow[]> {
  const period = opts.period ?? periodFor(new Date())
  const [y, m] = period.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
  const rows = await prisma.$queryRaw<{ userId: string; points: bigint | number }[]>`
    SELECT a."userId" AS "userId",
           SUM(CASE WHEN t.type::text IN (${Prisma.join(EARNED_TYPES)}) AND t.points > 0 THEN t.points
                    WHEN t.type::text = 'REVERSAL' AND t."idempotencyKey" LIKE ${`${EARN_REVERSAL_PREFIX}%`} THEN t.points
                    ELSE 0 END) AS points
      FROM loyalty_transactions t
      JOIN loyalty_accounts a ON a.id = t."accountId"
      JOIN memberships ms ON ms."userId" = a."userId" AND ms.status = 'ACTIVE' AND ms.tier::text <> 'NONE'
      LEFT JOIN vip_profiles p ON p."userId" = a."userId"
     WHERE t."createdAt" >= ${start} AND t."createdAt" < ${end}
       AND COALESCE(p."hideFromLeaderboards", false) = false
       AND p."suspendedAt" IS NULL
     GROUP BY a."userId"
    HAVING SUM(CASE WHEN t.type::text IN (${Prisma.join(EARNED_TYPES)}) AND t.points > 0 THEN t.points
                    WHEN t.type::text = 'REVERSAL' AND t."idempotencyKey" LIKE ${`${EARN_REVERSAL_PREFIX}%`} THEN t.points
                    ELSE 0 END) > 0
     ORDER BY points DESC, a."userId" ASC
     LIMIT ${limit}`
  if (!rows.length) return []
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, username: true, vipProfile: { select: { displayName: true, avatarUrl: true } } },
  })
  const byId = new Map(users.map((u) => [u.id, u]))
  let rank = 0
  let last: number | null = null
  return rows.map((r, i) => {
    const points = Number(r.points)
    if (points !== last) rank = i + 1
    last = points
    const u = byId.get(r.userId)
    return {
      userId: r.userId,
      points,
      rank,
      displayName: u?.vipProfile?.displayName || u?.name || u?.username || 'Member',
      avatarUrl: u?.vipProfile?.avatarUrl ?? null,
    }
  })
}

/** The viewer's own monthly score (shown even when hidden from the list). */
export async function myMonthlyPoints(userId: string, period = periodFor(new Date())): Promise<number> {
  const acct = await prisma.loyaltyAccount.findUnique({ where: { userId }, select: { id: true } })
  if (!acct) return 0
  const [y, m] = period.split('-').map(Number)
  const createdAt = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) }
  const [earned, reversed] = await Promise.all([
    prisma.loyaltyTransaction.aggregate({ where: { accountId: acct.id, createdAt, type: { in: EARNED_TYPES }, points: { gt: 0 } }, _sum: { points: true } }),
    prisma.loyaltyTransaction.aggregate({
      where: { accountId: acct.id, createdAt, type: 'REVERSAL', idempotencyKey: { startsWith: EARN_REVERSAL_PREFIX } },
      _sum: { points: true },
    }),
  ])
  return (earned._sum.points ?? 0) + (reversed._sum.points ?? 0)
}
