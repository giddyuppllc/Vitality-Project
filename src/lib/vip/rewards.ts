import type { MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'

/**
 * Monthly clubhouse rewards, spent at vitalityproject.global checkout.
 *
 * The reward IS store credit: it is written to the existing StoreCredit /
 * StoreCreditTxn ledger (type MEMBER_REWARD), which the store already reads
 * in /account/credits and spends in api/checkout (useStoreCredit). Nothing
 * new is spent here; this only deposits.
 *
 * Amounts are admin settings (VipTierReward). Absent row or 0 = OFF — no
 * amount is assumed anywhere in code.
 *
 * Idempotency: VipRewardGrant has UNIQUE(userId, period). The grant row is
 * inserted ON CONFLICT DO NOTHING inside ONE transaction with the balance
 * increment and the ledger line: if the row already exists (earlier or
 * concurrent run) nothing else is written. Running the cron twice → one grant.
 */

export const REWARD_TIERS = ['CLUB', 'PLUS', 'PREMIUM'] as const
export type RewardTier = (typeof REWARD_TIERS)[number]

/** "YYYY-MM" in UTC. */
export function periodFor(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function getTierRewardSettings(): Promise<Record<RewardTier, number>> {
  const rows = await prisma.vipTierReward.findMany()
  const out: Record<RewardTier, number> = { CLUB: 0, PLUS: 0, PREMIUM: 0 }
  for (const r of rows) {
    if (r.tier !== 'NONE') out[r.tier as RewardTier] = Math.max(0, r.monthlyCreditCents)
  }
  return out
}

export function rewardDescription(tier: MembershipTier, period: string): string {
  return `VIP monthly member reward (${TIER_BENEFITS[tier].label}, ${period})`
}

export interface RewardDecision {
  userId: string
  tier: MembershipTier
  amountCents: number
  outcome: 'granted' | 'would_grant' | 'already_granted' | 'off' | 'failed'
}

export interface RewardRunResult {
  [key: string]: unknown
  ok: true
  period: string
  dryRun: boolean
  examined: number
  granted: number
  alreadyGranted: number
  off: number
  failed: number
  totalCents: number
  decisions?: RewardDecision[]
}

export async function runMemberRewards(
  opts: { now?: Date; dryRun?: boolean } = {},
): Promise<RewardRunResult> {
  const now = opts.now ?? new Date()
  const dryRun = !!opts.dryRun
  const period = periodFor(now)
  const settings = await getTierRewardSettings()

  // Same eligibility as every store benefit: ACTIVE, paid tier.
  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE', tier: { not: 'NONE' } },
    select: { userId: true, tier: true },
    orderBy: { createdAt: 'asc' },
  })
  const existing = new Set(
    (
      await prisma.vipRewardGrant.findMany({ where: { period }, select: { userId: true } })
    ).map((g) => g.userId),
  )

  const result: RewardRunResult = {
    ok: true,
    period,
    dryRun,
    examined: memberships.length,
    granted: 0,
    alreadyGranted: 0,
    off: 0,
    failed: 0,
    totalCents: 0,
  }
  const decisions: RewardDecision[] = []

  for (const m of memberships) {
    const amountCents = settings[m.tier as RewardTier] ?? 0
    const base = { userId: m.userId, tier: m.tier, amountCents }
    if (amountCents <= 0) {
      result.off++
      decisions.push({ ...base, outcome: 'off' })
      continue
    }
    if (existing.has(m.userId)) {
      result.alreadyGranted++
      decisions.push({ ...base, outcome: 'already_granted' })
      continue
    }
    if (dryRun) {
      decisions.push({ ...base, outcome: 'would_grant' })
      continue
    }
    try {
      const granted = await prisma.$transaction(async (tx) => {
        // INSERT … ON CONFLICT DO NOTHING on UNIQUE(userId, period): 0 rows
        // means another run already granted this member this month.
        const { count } = await tx.vipRewardGrant.createMany({
          data: [{ userId: m.userId, period, tier: m.tier, amountCents }],
          skipDuplicates: true,
        })
        if (count === 0) return false
        const credit = await tx.storeCredit.upsert({
          where: { userId: m.userId },
          update: { balance: { increment: amountCents } },
          create: { userId: m.userId, balance: amountCents },
        })
        const txn = await tx.storeCreditTxn.create({
          data: {
            creditId: credit.id,
            type: 'MEMBER_REWARD',
            amount: amountCents,
            description: rewardDescription(m.tier, period),
          },
        })
        await tx.vipRewardGrant.update({
          where: { userId_period: { userId: m.userId, period } },
          data: { storeCreditTxnId: txn.id },
        })
        return true
      })
      if (granted) {
        result.granted++
        result.totalCents += amountCents
        decisions.push({ ...base, outcome: 'granted' })
      } else {
        result.alreadyGranted++
        decisions.push({ ...base, outcome: 'already_granted' })
      }
    } catch (err) {
      console.error('[vip/rewards] grant failed for', m.userId, err)
      result.failed++
      decisions.push({ ...base, outcome: 'failed' })
    }
  }

  if (dryRun) result.decisions = decisions
  return result
}
