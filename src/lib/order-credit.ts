import { prisma } from '@/lib/prisma'

/**
 * Store credit on the Zelle checkout (vitalityproject.global).
 *
 * SPEND — at order time, inside the same transaction that creates the order:
 * one conditional `UPDATE … WHERE balance >= amount` (never a read-then-write),
 * so a balance can never go negative and two simultaneous checkouts cannot
 * both spend the same dollars. The debit is a CHECKOUT_APPLY ledger line tied
 * to the order (StoreCreditTxn.orderId) and the amount is kept on
 * Order.storeCreditUsed; Order.total is what is still due by Zelle.
 *
 * RESTORE — when that order is cancelled (admin), expires unpaid (the
 * stale-zelle cron) or is fully refunded: the credit comes back exactly once.
 * The member's StoreCredit row is locked (SELECT … FOR UPDATE) and the amount
 * returned is recomputed from the order's own ledger lines
 * (spent − already restored), so a second, concurrent or repeated restore
 * finds nothing left to return. A restore on an order that is still open or
 * paid returns nothing.
 *
 * The card checkout (api/checkout → applyStoreCredit) is unchanged.
 */

/** The interactive-transaction client of our (extended) prisma instance. */
export type Tx = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export class InsufficientCreditError extends Error {
  constructor() {
    super('Your store credit balance changed while you were checking out. Please review your order and place it again.')
    this.name = 'InsufficientCreditError'
  }
}

/** How much credit an order may use: the smaller of the balance and the amount due. */
export async function plannedCreditUse(userId: string, amountDueCents: number, db: Tx | typeof prisma = prisma): Promise<number> {
  if (amountDueCents <= 0) return 0
  const credit = await db.storeCredit.findUnique({ where: { userId }, select: { balance: true } })
  return Math.max(0, Math.min(credit?.balance ?? 0, amountDueCents))
}

/**
 * Debit `amountCents` for `orderId`. Must run inside the transaction that
 * creates the order. Throws InsufficientCreditError (rolling the order back)
 * if the balance no longer covers the amount.
 */
export async function spendCreditForOrder(
  tx: Tx,
  args: { userId: string; orderId: string; orderNumber: string; amountCents: number },
): Promise<number> {
  const { userId, orderId, orderNumber, amountCents } = args
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 0
  const { count } = await tx.storeCredit.updateMany({
    where: { userId, balance: { gte: amountCents } },
    data: { balance: { decrement: amountCents } },
  })
  if (count !== 1) throw new InsufficientCreditError()
  const credit = await tx.storeCredit.findUniqueOrThrow({ where: { userId }, select: { id: true } })
  await tx.storeCreditTxn.create({
    data: {
      creditId: credit.id,
      type: 'CHECKOUT_APPLY',
      amount: -amountCents,
      description: `Applied to Zelle order ${orderNumber}`,
      orderId,
    },
  })
  return amountCents
}

export type RestoreReason = 'cancelled' | 'expired' | 'refunded'

export interface RestoreResult {
  restored: number
  skipped?: 'no_user' | 'order_open' | 'nothing_to_restore' | 'not_found' | 'not_zelle'
}

/** Orders whose credit may come back: cancelled, refunded (order or payment). */
export function orderIsClosedForCredit(o: { status: string; paymentStatus: string }): boolean {
  return o.status === 'CANCELLED' || o.status === 'REFUNDED' || o.paymentStatus === 'REFUNDED'
}

const REASON_TEXT: Record<RestoreReason, string> = {
  cancelled: 'order cancelled',
  expired: 'Zelle payment not received in time',
  refunded: 'order refunded',
}

/**
 * Return the credit an order spent. Idempotent and race-safe; see the header.
 * Call it AFTER the order has been moved to CANCELLED / REFUNDED.
 */
export async function restoreOrderCredit(orderId: string, reason: RestoreReason): Promise<RestoreResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, userId: true, status: true, paymentStatus: true, paymentMethod: true },
    })
    if (!order) return { restored: 0, skipped: 'not_found' as const }
    // Zelle orders only — the card checkout's credit handling is unchanged.
    if (order.paymentMethod !== 'zelle') return { restored: 0, skipped: 'not_zelle' as const }
    if (!order.userId) return { restored: 0, skipped: 'no_user' as const }

    // Serialise every restore for this member behind one row lock.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "store_credits" WHERE "userId" = ${order.userId} FOR UPDATE`
    if (!locked.length) return { restored: 0, skipped: 'nothing_to_restore' as const }
    const creditId = locked[0].id

    // Re-read the order under the lock: it must be closed.
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, paymentStatus: true } })
    if (!orderIsClosedForCredit(fresh)) return { restored: 0, skipped: 'order_open' as const }

    const lines = await tx.storeCreditTxn.findMany({
      where: { creditId, orderId, type: { in: ['CHECKOUT_APPLY', 'CHECKOUT_RESTORE'] } },
      select: { type: true, amount: true },
    })
    const spent = lines.filter((l) => l.type === 'CHECKOUT_APPLY').reduce((s, l) => s - l.amount, 0)
    const back = lines.filter((l) => l.type === 'CHECKOUT_RESTORE').reduce((s, l) => s + l.amount, 0)
    const due = spent - back
    if (due <= 0) return { restored: 0, skipped: 'nothing_to_restore' as const }

    await tx.storeCredit.update({ where: { id: creditId }, data: { balance: { increment: due } } })
    await tx.storeCreditTxn.create({
      data: {
        creditId,
        type: 'CHECKOUT_RESTORE',
        amount: due,
        description: `Returned from order ${order.orderNumber} (${REASON_TEXT[reason]})`,
        orderId,
      },
    })
    return { restored: due }
  })
}

/** Credit an order spent and has not had back yet (for admin/mark-paid guards). */
export async function outstandingOrderCredit(orderId: string): Promise<{ spent: number; restored: number }> {
  const lines = await prisma.storeCreditTxn.findMany({
    where: { orderId, type: { in: ['CHECKOUT_APPLY', 'CHECKOUT_RESTORE'] } },
    select: { type: true, amount: true },
  })
  return {
    spent: lines.filter((l) => l.type === 'CHECKOUT_APPLY').reduce((s, l) => s - l.amount, 0),
    restored: lines.filter((l) => l.type === 'CHECKOUT_RESTORE').reduce((s, l) => s + l.amount, 0),
  }
}
