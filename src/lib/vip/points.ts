// ──────────────────────────────────────────────────────────────────────────
// Shared points ledger for the whole Vitality ecosystem.
//
// ONE balance per member (LoyaltyAccount.points, 100 points = $1), written
// from three places: .global purchases (lib/loyalty.ts), the .vip clubhouse
// (lessons, posts, events, workouts, challenges, streaks…) and partner
// businesses in the rewards network. Every clubhouse/partner feature awards
// and spends through THIS module so that:
//
//   • awards are exactly-once: pass an idempotencyKey ("lesson:<id>:<user>");
//     a repeat with the same key returns the original award and changes
//     nothing, even under concurrent requests (unique index on the key);
//   • spends never overdraw: one conditional UPDATE … WHERE points >= n;
//   • every movement is a LoyaltyTransaction row (the statement/history).
// ──────────────────────────────────────────────────────────────────────────

import { Prisma, type LoyaltyTxType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type Tx = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export const CENTS_PER_POINT = 1 // 100 points = $1

export const pointsToCents = (points: number) => points * CENTS_PER_POINT
export const centsToPoints = (cents: number) => Math.floor(cents / CENTS_PER_POINT)

const EARN_TYPES: LoyaltyTxType[] = ['EARN_ENGAGEMENT', 'EARN_PARTNER', 'EARN_ADMIN', 'EARN_REFERRAL', 'ADJUST', 'REVERSAL']
const SPEND_TYPES: LoyaltyTxType[] = ['REDEEM_REWARD', 'REDEEM_PARTNER', 'ADJUST', 'REVERSAL', 'EXPIRE']

export class InsufficientPointsError extends Error {
  constructor(message = 'Not enough points') {
    super(message)
    this.name = 'InsufficientPointsError'
  }
}

export type PointsResult = { transactionId: string; points: number; balance: number; duplicate: boolean }

async function ensureAccount(tx: Tx, userId: string) {
  return tx.loyaltyAccount.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  })
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/**
 * Award points. Exactly-once per idempotencyKey. Returns the transaction and
 * the new balance; `duplicate: true` when the key was already used (nothing
 * changed). Throws on points <= 0 or a non-earn type.
 */
export async function awardPoints(args: {
  userId: string
  points: number
  type: LoyaltyTxType
  description: string
  idempotencyKey: string
  source?: string
  tx?: Tx
}): Promise<PointsResult> {
  const { userId, points, type, description, idempotencyKey, source = 'vip' } = args
  if (!Number.isInteger(points) || points <= 0) throw new Error('awardPoints: points must be a positive integer')
  if (!EARN_TYPES.includes(type)) throw new Error(`awardPoints: ${type} is not an earn type`)
  if (!idempotencyKey) throw new Error('awardPoints: idempotencyKey is required')

  const existing = await (args.tx ?? prisma).loyaltyTransaction.findUnique({ where: { idempotencyKey } })
  if (existing) return duplicateResult(existing.id, existing.points, userId, args.tx)

  const run = async (tx: Tx) => {
    const account = await ensureAccount(tx, userId)
    const row = await tx.loyaltyTransaction.create({
      data: { accountId: account.id, type, points, description, idempotencyKey, source },
    })
    const updated = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: { increment: points } },
      select: { points: true },
    })
    return { transactionId: row.id, points, balance: updated.points, duplicate: false }
  }

  try {
    return args.tx ? await run(args.tx) : await prisma.$transaction((tx) => run(tx))
  } catch (e) {
    // Lost a race on the same key: the other request's award stands.
    if (isUniqueViolation(e) && !args.tx) {
      const row = await prisma.loyaltyTransaction.findUnique({ where: { idempotencyKey } })
      if (row) return duplicateResult(row.id, row.points, userId)
    }
    throw e
  }
}

/**
 * Spend points. Never overdraws (conditional decrement). Optional
 * idempotencyKey makes a retried spend a no-op. Throws
 * InsufficientPointsError when the balance doesn't cover it.
 */
export async function spendPoints(args: {
  userId: string
  points: number
  type: LoyaltyTxType
  description: string
  idempotencyKey?: string
  source?: string
  orderId?: string
  tx?: Tx
}): Promise<PointsResult> {
  const { userId, points, type, description, idempotencyKey, source = 'vip', orderId } = args
  if (!Number.isInteger(points) || points <= 0) throw new Error('spendPoints: points must be a positive integer')
  if (!SPEND_TYPES.includes(type)) throw new Error(`spendPoints: ${type} is not a spend type`)

  if (idempotencyKey) {
    const existing = await (args.tx ?? prisma).loyaltyTransaction.findUnique({ where: { idempotencyKey } })
    if (existing) return duplicateResult(existing.id, existing.points, userId, args.tx)
  }

  const run = async (tx: Tx) => {
    const { count } = await tx.loyaltyAccount.updateMany({
      where: { userId, points: { gte: points } },
      data: { points: { decrement: points } },
    })
    if (count !== 1) throw new InsufficientPointsError()
    const account = await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId }, select: { id: true, points: true } })
    const row = await tx.loyaltyTransaction.create({
      data: { accountId: account.id, type, points: -points, description, idempotencyKey, source, orderId },
    })
    return { transactionId: row.id, points: -points, balance: account.points, duplicate: false }
  }

  try {
    return args.tx ? await run(args.tx) : await prisma.$transaction((tx) => run(tx))
  } catch (e) {
    if (idempotencyKey && isUniqueViolation(e) && !args.tx) {
      const row = await prisma.loyaltyTransaction.findUnique({ where: { idempotencyKey } })
      if (row) return duplicateResult(row.id, row.points, userId)
    }
    throw e
  }
}

async function duplicateResult(id: string, pts: number, userId: string, tx?: Tx): Promise<PointsResult> {
  const acct = await (tx ?? prisma).loyaltyAccount.findUnique({ where: { userId }, select: { points: true } })
  return { transactionId: id, points: pts, balance: acct?.points ?? 0, duplicate: true }
}

export async function pointsBalance(userId: string): Promise<number> {
  const acct = await prisma.loyaltyAccount.findUnique({ where: { userId }, select: { points: true } })
  return acct?.points ?? 0
}

export async function pointsHistory(userId: string, opts: { take?: number; cursor?: string } = {}) {
  const acct = await prisma.loyaltyAccount.findUnique({ where: { userId }, select: { id: true } })
  if (!acct) return []
  return prisma.loyaltyTransaction.findMany({
    where: { accountId: acct.id },
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.take ?? 50, 200),
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  })
}
