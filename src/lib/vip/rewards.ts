import type { MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { getVipSettings } from './settings'
import { addUtcMonths } from './time'
import { rewardIssuedEmail } from './emails'
import { sendVipEmail } from './mailer'
import { GLOBAL_LINKS } from './links'

/**
 * Monthly clubhouse rewards, spent at vitalityproject.global checkout.
 *
 * The reward IS store credit: it is written to the existing StoreCredit /
 * StoreCreditTxn ledger (type MEMBER_REWARD), which the store already reads
 * in /account/credits and spends at both checkouts (card: useStoreCredit;
 * Zelle: lib/order-credit.ts). Nothing is spent here; this only deposits.
 *
 * Decisions made 09-29 (docs/VIP_CLUBHOUSE.md → "Assumptions made 09-29"):
 *  - Amounts: DEFAULT_TIER_REWARD_CENTS (Club $5 / Plus $20 / Premium Stacks
 *    $50) until an admin saves other values at /admin/vip/rewards (0 = off).
 *  - Timing: granted on the 1st of the month (UTC) to members ACTIVE that day.
 *    A run on any other day grants nothing unless `catchUp` is passed (for a
 *    missed 1st). PAST_DUE / PAUSED / CANCELLED / PENDING members get nothing;
 *    neither do members suspended from the community.
 *  - Expiry: each reward expires `vip.rewardExpiryMonths` (default 12) after
 *    it was issued; see expireRewardCredit(). 0 = never.
 *
 * Idempotency: VipRewardGrant has UNIQUE(userId, period). The grant row is
 * inserted ON CONFLICT DO NOTHING inside ONE transaction with the balance
 * increment and the ledger line: if the row already exists (earlier or
 * concurrent run) nothing else is written. Running the cron twice → one grant.
 */

export const REWARD_TIERS = ['CLUB', 'PLUS', 'PREMIUM'] as const
export type RewardTier = (typeof REWARD_TIERS)[number]

export const DEFAULT_TIER_REWARD_CENTS: Record<RewardTier, number> = {
  CLUB: 500,
  PLUS: 2000,
  PREMIUM: 5000,
}

/** "YYYY-MM" in UTC. */
export function periodFor(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Per-tier monthly credit: saved admin values, else the defaults above. */
export async function getTierRewardSettings(): Promise<Record<RewardTier, number>> {
  const rows = await prisma.vipTierReward.findMany()
  const out: Record<RewardTier, number> = { ...DEFAULT_TIER_REWARD_CENTS }
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
  outcome: 'granted' | 'would_grant' | 'already_granted' | 'off' | 'suspended' | 'failed'
}

export interface RewardRunResult {
  [key: string]: unknown
  ok: true
  period: string
  dryRun: boolean
  skipped?: 'not_first_of_month'
  examined: number
  granted: number
  alreadyGranted: number
  off: number
  suspended: number
  failed: number
  totalCents: number
  emailed: number
  expiry?: ExpiryRunResult
  decisions?: RewardDecision[]
}

/** Is `userId` eligible for this month's reward right now? (Used by tests + admin.) */
export async function rewardEligibility(userId: string): Promise<{ eligible: boolean; tier: MembershipTier; reason?: string }> {
  const m = await prisma.membership.findUnique({ where: { userId }, select: { status: true, tier: true } })
  if (!m || m.tier === 'NONE') return { eligible: false, tier: 'NONE', reason: 'no_membership' }
  if (m.status !== 'ACTIVE') return { eligible: false, tier: m.tier, reason: `status_${m.status.toLowerCase()}` }
  const p = await prisma.vipProfile.findUnique({ where: { userId }, select: { suspendedAt: true } })
  if (p?.suspendedAt) return { eligible: false, tier: m.tier, reason: 'suspended' }
  return { eligible: true, tier: m.tier }
}

export async function runMemberRewards(
  opts: { now?: Date; dryRun?: boolean; catchUp?: boolean; sendEmails?: boolean } = {},
): Promise<RewardRunResult> {
  const now = opts.now ?? new Date()
  const dryRun = !!opts.dryRun
  const period = periodFor(now)
  const result: RewardRunResult = {
    ok: true,
    period,
    dryRun,
    examined: 0,
    granted: 0,
    alreadyGranted: 0,
    off: 0,
    suspended: 0,
    failed: 0,
    totalCents: 0,
    emailed: 0,
  }

  // Expiry runs every day, independent of the grant day.
  result.expiry = await expireRewardCredit({ now, dryRun })

  if (now.getUTCDate() !== 1 && !opts.catchUp) {
    result.skipped = 'not_first_of_month'
    if (!dryRun && opts.sendEmails !== false) result.emailed = await sendPendingRewardNotices(period)
    return result
  }

  const settings = await getTierRewardSettings()
  // Same eligibility as every store benefit: ACTIVE, paid tier. Plus: not
  // suspended from the community.
  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE', tier: { not: 'NONE' } },
    select: { userId: true, tier: true, user: { select: { vipProfile: { select: { suspendedAt: true } } } } },
    orderBy: { createdAt: 'asc' },
  })
  result.examined = memberships.length
  const existing = new Set(
    (await prisma.vipRewardGrant.findMany({ where: { period }, select: { userId: true } })).map((g) => g.userId),
  )

  const decisions: RewardDecision[] = []

  for (const m of memberships) {
    const amountCents = settings[m.tier as RewardTier] ?? 0
    const base = { userId: m.userId, tier: m.tier, amountCents }
    if (amountCents <= 0) {
      result.off++
      decisions.push({ ...base, outcome: 'off' })
      continue
    }
    if (m.user.vipProfile?.suspendedAt) {
      result.suspended++
      decisions.push({ ...base, outcome: 'suspended' })
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

  if (!dryRun && opts.sendEmails !== false) {
    result.emailed = await sendPendingRewardNotices(period)
  }
  if (dryRun) result.decisions = decisions
  return result
}

/**
 * Sends the "reward issued" email for this month's grants that haven't had
 * one yet. Runs on every daily pass, so a notice held back (the clubhouse
 * domain not live yet, or a failed send) goes out on a later day of the same
 * month. `noticeAt` is claimed before the send and released if it fails, so
 * overlapping runs never send twice. Earlier months are never sent late.
 */
async function sendPendingRewardNotices(period: string): Promise<number> {
  const pending = await prisma.vipRewardGrant.findMany({
    where: { period, noticeAt: null },
    select: { id: true, userId: true, tier: true, amountCents: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!pending.length) return 0
  const { 'vip.rewardExpiryMonths': months } = await getVipSettings()
  let sent = 0
  for (const g of pending) {
    const claimedAt = new Date()
    const { count } = await prisma.vipRewardGrant.updateMany({ where: { id: g.id, noticeAt: null }, data: { noticeAt: claimedAt } })
    if (count !== 1) continue
    let ok = false
    try {
      const u = await prisma.user.findUnique({
        where: { id: g.userId },
        select: { email: true, name: true, storeCredit: { select: { balance: true } }, vipProfile: { select: { emailRewards: true } } },
      })
      // Turned off (or gone): handled, nothing to send.
      if (!u || u.vipProfile?.emailRewards === false) continue
      const [y, m] = period.split('-').map(Number)
      const expires = months > 0 ? addUtcMonths(new Date(Date.UTC(y, m - 1, 1)), months) : null
      ok = await sendVipEmail(
        u.email,
        rewardIssuedEmail({
          userId: g.userId,
          name: u.name,
          tierLabel: TIER_BENEFITS[g.tier].label,
          amountCents: g.amountCents,
          monthLabel: monthLabel(period),
          balanceCents: u.storeCredit?.balance ?? g.amountCents,
          expiresLabel: expires
            ? new Date(expires.getTime() - 86400e3).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
            : null,
          shopUrl: GLOBAL_LINKS.shop(),
        }),
      )
      if (ok) sent++
    } catch (err) {
      console.error('[vip/rewards] reward email failed for', g.userId, err)
    }
    // Not sent: release the claim so the next daily run tries again.
    if (!ok) await prisma.vipRewardGrant.updateMany({ where: { id: g.id, noticeAt: claimedAt }, data: { noticeAt: null } })
  }
  return sent
}

// ─── Expiry ─────────────────────────────────────────────────────────────────
export interface ExpiryRunResult {
  months: number
  members: number
  expiredCents: number
  would?: Array<{ userId: string; cents: number }>
}

type Lot = { at: Date; remaining: number; reward: boolean }

/**
 * How much of a member's balance is reward credit past its expiry date.
 *
 * Replays the member's ledger oldest-first as "lots": every credit line opens
 * a lot; spending (CHECKOUT_APPLY and any other debit) uses the oldest lots
 * first; EXPIRE lines use the oldest reward lots. A restore
 * (CHECKOUT_RESTORE) opens a fresh non-expiring lot. What remains in reward
 * lots issued on or before `cutoff` is the amount to expire now. Because
 * earlier EXPIRE lines are replayed too, running it again returns 0.
 */
export function expirableRewardCents(
  txns: Array<{ type: string; amount: number; createdAt: Date }>,
  cutoff: Date,
): number {
  const lots: Lot[] = []
  const consume = (amount: number, only: (l: Lot) => boolean) => {
    let left = amount
    for (const l of lots) {
      if (left <= 0) break
      if (l.remaining <= 0 || !only(l)) continue
      const take = Math.min(l.remaining, left)
      l.remaining -= take
      left -= take
    }
    return left
  }
  for (const t of txns) {
    if (t.amount > 0) {
      lots.push({ at: t.createdAt, remaining: t.amount, reward: t.type === 'MEMBER_REWARD' })
    } else if (t.amount < 0) {
      if (t.type === 'EXPIRE') {
        const left = consume(-t.amount, (l) => l.reward)
        if (left > 0) consume(left, () => true)
      } else {
        consume(-t.amount, () => true)
      }
    }
  }
  return lots.filter((l) => l.reward && l.at <= cutoff).reduce((s, l) => s + l.remaining, 0)
}

export async function expireRewardCredit(opts: { now?: Date; dryRun?: boolean } = {}): Promise<ExpiryRunResult> {
  const now = opts.now ?? new Date()
  const { 'vip.rewardExpiryMonths': months } = await getVipSettings()
  const out: ExpiryRunResult = { months, members: 0, expiredCents: 0 }
  if (months <= 0) return out
  const cutoff = addUtcMonths(now, -months)

  const holders = await prisma.storeCreditTxn.findMany({
    where: { type: 'MEMBER_REWARD', createdAt: { lte: cutoff } },
    select: { creditId: true },
    distinct: ['creditId'],
  })
  if (opts.dryRun) out.would = []

  for (const { creditId } of holders) {
    const cents = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ balance: number }>>`
        SELECT "balance" FROM "store_credits" WHERE "id" = ${creditId} FOR UPDATE`
      if (!locked.length) return 0
      const txns = await tx.storeCreditTxn.findMany({
        where: { creditId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { type: true, amount: true, createdAt: true },
      })
      const due = Math.min(expirableRewardCents(txns, cutoff), Number(locked[0].balance))
      if (due <= 0 || opts.dryRun) return due
      await tx.storeCredit.update({ where: { id: creditId }, data: { balance: { decrement: due } } })
      await tx.storeCreditTxn.create({
        data: {
          creditId,
          type: 'EXPIRE',
          amount: -due,
          description: `Monthly reward credit expired (${months} months after issue)`,
          createdAt: now,
        },
      })
      return due
    })
    if (cents > 0) {
      out.members++
      out.expiredCents += cents
      if (opts.dryRun) {
        const c = await prisma.storeCredit.findUnique({ where: { id: creditId }, select: { userId: true } })
        out.would!.push({ userId: c?.userId ?? creditId, cents })
      }
    }
  }
  return out
}

/** Reward lots still in a member's balance, with their expiry dates (for /rewards). */
export async function upcomingRewardExpiries(userId: string): Promise<Array<{ issuedAt: Date; expiresAt: Date; cents: number }>> {
  const { 'vip.rewardExpiryMonths': months } = await getVipSettings()
  if (months <= 0) return []
  const credit = await prisma.storeCredit.findUnique({ where: { userId }, select: { id: true } })
  if (!credit) return []
  const txns = await prisma.storeCreditTxn.findMany({
    where: { creditId: credit.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { type: true, amount: true, createdAt: true },
  })
  // Replay with a cutoff far in the future → remaining per reward lot.
  const out: Array<{ issuedAt: Date; expiresAt: Date; cents: number }> = []
  const rewardTimes = txns.filter((t) => t.type === 'MEMBER_REWARD').map((t) => t.createdAt)
  let prev = 0
  for (const at of rewardTimes) {
    const upTo = expirableRewardCents(txns, at)
    const cents = upTo - prev
    prev = upTo
    if (cents > 0) out.push({ issuedAt: at, expiresAt: addUtcMonths(at, months), cents })
  }
  return out
}
