import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { getEarningRule } from './earning'
import { spendPoints, InsufficientPointsError } from './points'
import { addUtcMonths } from './time'

/**
 * Points expiry (plan §9: "points expire after 12 months of account
 * inactivity"). A balance expires in full when the account has had no points
 * activity — no earn, spend, refund or adjustment of any kind — for
 * `vip.points.expiryMonths` months (default 12, 0 = never). Any activity
 * restarts the clock.
 *
 * Exactly once per period of inactivity: the EXPIRE line is keyed on the
 * account's last activity (`expire:<userId>:<last activity id>`), and the
 * account row is locked while the decision is re-checked, so overlapping runs
 * or a member earning at the same moment can't expire twice or expire fresh
 * points.
 */

export interface ExpiryDecision {
  userId: string
  points: number
  lastActivityAt: string
  outcome: 'would_expire' | 'expired' | 'skipped'
}

async function lastActivity(accountId: string) {
  return prisma.loyaltyTransaction.findFirst({
    where: { accountId, type: { not: 'EXPIRE' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  })
}

export async function runPointsExpiry(opts: { now?: Date; dryRun?: boolean } = {}) {
  const now = opts.now ?? new Date()
  const months = await getEarningRule('vip.points.expiryMonths')
  if (!months) return { ok: true, months, dryRun: !!opts.dryRun, examined: 0, expiredAccounts: 0, expiredPoints: 0, wouldExpirePoints: 0, decisions: [] as ExpiryDecision[] }
  const cutoff = addUtcMonths(now, -months)

  const candidates = await prisma.$queryRaw<{ id: string; userId: string; points: number; last: Date | null; createdAt: Date }[]>`
    SELECT a.id, a."userId" AS "userId", a.points, a."createdAt" AS "createdAt",
           MAX(t."createdAt") FILTER (WHERE t.type::text <> 'EXPIRE') AS last
      FROM loyalty_accounts a
      LEFT JOIN loyalty_transactions t ON t."accountId" = a.id
     WHERE a.points > 0
     GROUP BY a.id
    HAVING COALESCE(MAX(t."createdAt") FILTER (WHERE t.type::text <> 'EXPIRE'), a."createdAt") < ${cutoff}
     ORDER BY a.id
     LIMIT 5000`

  const decisions: ExpiryDecision[] = []
  let expiredPoints = 0
  for (const c of candidates) {
    const lastAt = c.last ?? c.createdAt
    if (opts.dryRun) {
      decisions.push({ userId: c.userId, points: c.points, lastActivityAt: lastAt.toISOString(), outcome: 'would_expire' })
      continue
    }
    try {
      const done = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM loyalty_accounts WHERE id = ${c.id} FOR UPDATE`
        const acct = await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: c.id }, select: { points: true, createdAt: true } })
        const last = await tx.loyaltyTransaction.findFirst({
          where: { accountId: c.id, type: { not: 'EXPIRE' } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        })
        const at = last?.createdAt ?? acct.createdAt
        if (acct.points <= 0 || at >= cutoff) return 0 // became active meanwhile
        const r = await spendPoints({
          tx,
          userId: c.userId,
          points: acct.points,
          type: 'EXPIRE',
          description: `Points expired after ${months} months without activity`,
          idempotencyKey: `expire:${c.userId}:${last?.id ?? 'account'}`,
          source: 'vip:expiry',
        })
        return r.duplicate ? 0 : acct.points
      })
      if (done > 0) {
        expiredPoints += done
        decisions.push({ userId: c.userId, points: done, lastActivityAt: lastAt.toISOString(), outcome: 'expired' })
      } else {
        decisions.push({ userId: c.userId, points: 0, lastActivityAt: lastAt.toISOString(), outcome: 'skipped' })
      }
    } catch (e) {
      if (!(e instanceof InsufficientPointsError)) console.error('[points-expiry] failed for', c.userId, e)
      decisions.push({ userId: c.userId, points: 0, lastActivityAt: lastAt.toISOString(), outcome: 'skipped' })
    }
  }
  const expiredAccounts = decisions.filter((d) => d.outcome === 'expired').length
  if (!opts.dryRun && expiredAccounts > 0) {
    await logAudit({ action: 'vip.points.expire', entityType: 'LoyaltyAccount', metadata: { months, expiredAccounts, expiredPoints } })
  }
  return {
    ok: true,
    months,
    dryRun: !!opts.dryRun,
    examined: candidates.length,
    expiredAccounts,
    expiredPoints,
    wouldExpirePoints: opts.dryRun ? decisions.reduce((n, d) => n + d.points, 0) : 0,
    decisions,
  }
}

/** When this member's balance would expire if nothing happens before then (null = never / no balance). */
export async function pointsExpiryFor(userId: string): Promise<{ expiresAt: Date; points: number; months: number } | null> {
  const months = await getEarningRule('vip.points.expiryMonths')
  if (!months) return null
  const acct = await prisma.loyaltyAccount.findUnique({ where: { userId }, select: { id: true, points: true, createdAt: true } })
  if (!acct || acct.points <= 0) return null
  const last = await lastActivity(acct.id)
  return { expiresAt: addUtcMonths(last?.createdAt ?? acct.createdAt, months), points: acct.points, months }
}
