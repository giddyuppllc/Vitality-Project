import { prisma } from '@/lib/prisma'
import { restoreOrderCredit } from '@/lib/order-credit'
import { getVipSetting } from '@/lib/vip/settings'
import { logAudit } from '@/lib/audit'

/**
 * Unpaid Zelle order expiry (run by api/cron/stale-zelle-orders).
 * Admin setting `zelle.unpaidExpiryDays` (default 14, 0 = never).
 */
export interface ExpiryResult {
  ok: true
  dryRun: boolean
  expiryDays: number
  expired: number
  creditReturnedCents: number
  orders: Array<{ orderNumber: string; ageDays: number; storeCreditUsed: number; outcome: 'expired' | 'would_expire' | 'raced' }>
}

/** Cancel Zelle orders left unpaid past the admin-set window; return their credit. */
export async function expireUnpaidZelleOrders(opts: { now?: Date; dryRun?: boolean } = {}): Promise<ExpiryResult> {
  const now = opts.now ?? new Date()
  const dryRun = !!opts.dryRun
  const expiryDays = await getVipSetting('zelle.unpaidExpiryDays')
  const result: ExpiryResult = { ok: true, dryRun, expiryDays, expired: 0, creditReturnedCents: 0, orders: [] }
  if (expiryDays <= 0) return result

  const cutoff = new Date(now.getTime() - expiryDays * 86400e3)
  const due = await prisma.order.findMany({
    where: {
      paymentMethod: 'zelle',
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      createdAt: { lte: cutoff },
      OR: [{ notes: null }, { NOT: { notes: { startsWith: 'MEMBERSHIP:' } } }],
    },
    select: { id: true, orderNumber: true, createdAt: true, storeCreditUsed: true, notes: true },
    orderBy: { createdAt: 'asc' },
    take: 100, // safety cap per run
  })

  for (const o of due) {
    const ageDays = Math.floor((now.getTime() - o.createdAt.getTime()) / 86400e3)
    if (dryRun) {
      result.orders.push({ orderNumber: o.orderNumber, ageDays, storeCreditUsed: o.storeCreditUsed, outcome: 'would_expire' })
      continue
    }
    // Conditional: only if it is STILL unpaid + pending (mark-paid may have raced us).
    const { count } = await prisma.order.updateMany({
      where: { id: o.id, status: 'PENDING', paymentStatus: 'UNPAID' },
      data: {
        status: 'CANCELLED',
        notes: `${o.notes ? `${o.notes}

` : ''}[Auto-cancelled ${now.toISOString().slice(0, 10)}: Zelle payment not received within ${expiryDays} days]`,
      },
    })
    if (count !== 1) {
      result.orders.push({ orderNumber: o.orderNumber, ageDays, storeCreditUsed: o.storeCreditUsed, outcome: 'raced' })
      continue
    }
    const { restored } = await restoreOrderCredit(o.id, 'expired')
    result.expired += 1
    result.creditReturnedCents += restored
    result.orders.push({ orderNumber: o.orderNumber, ageDays, storeCreditUsed: o.storeCreditUsed, outcome: 'expired' })
    await logAudit({
      action: 'order.auto_cancel.zelle_unpaid',
      entityType: 'Order',
      entityId: o.id,
      metadata: { expiryDays, ageDays, creditReturnedCents: restored },
    })
  }
  return result
}

