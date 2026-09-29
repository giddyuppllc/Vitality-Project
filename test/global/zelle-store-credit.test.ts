import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST as zellePOST } from '@/app/api/checkout-zelle/route'
import { PATCH as orderPATCH } from '@/app/api/admin/orders/[id]/route'
import { POST as refundPOST } from '@/app/api/admin/orders/[id]/refund/route'
import { POST as markPaidPOST } from '@/app/api/admin/orders/[id]/mark-paid/route'
import { expireUnpaidZelleOrders } from '@/lib/zelle-expiry'
import {
  InsufficientCreditError,
  restoreOrderCredit,
  spendCreditForOrder,
} from '@/lib/order-credit'
import { makeUser, params, req, setSession } from '../helpers'

/**
 * Store credit on the .global Zelle checkout (decided 09-29, open question 1):
 * spent at order time, returned exactly once on cancel / expiry / full refund.
 * Fixtures are fake (ZZ-TEST products, zz-*@example.invalid users) and live only
 * in the throwaway DB.
 */

const ADDRESS = { name: 'ZZ Test', line1: '1 Test St', city: 'Testville', state: 'AZ', zip: '85001', country: 'US' }

async function product(priceCents: number) {
  return prisma.product.create({
    data: {
      name: 'ZZ-TEST credit fixture',
      description: 'Test fixture (throwaway DB only)',
      slug: `zz-test-credit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      price: priceCents,
      status: 'ACTIVE',
      trackInventory: false,
    },
  })
}

async function giveCredit(userId: string, cents: number) {
  const c = await prisma.storeCredit.upsert({
    where: { userId },
    update: { balance: { increment: cents } },
    create: { userId, balance: cents },
  })
  await prisma.storeCreditTxn.create({ data: { creditId: c.id, type: 'ADMIN_GRANT', amount: cents, description: 'ZZ test credit' } })
}

const balance = async (userId: string) => (await prisma.storeCredit.findUnique({ where: { userId } }))?.balance ?? 0

async function placeZelle(user: { id: string; email: string }, productId: string, extra: Record<string, unknown> = {}) {
  setSession(user)
  const res = await zellePOST(
    req('/api/checkout-zelle', {
      body: { items: [{ productId, quantity: 1 }], email: user.email, shippingAddress: ADDRESS, ...extra },
    }),
  )
  const body = await res.json()
  return { res, body }
}

async function adminSession() {
  const admin = await makeUser({ tag: 'zc-admin', role: 'ADMIN' })
  setSession({ ...admin, role: 'ADMIN' })
  return admin
}

describe('Zelle checkout spends store credit', () => {
  beforeEach(async () => {
    await prisma.siteSetting.deleteMany({ where: { key: 'zelle.unpaidExpiryDays' } })
  })

  it('debits available credit at order time, ties the ledger line to the order, and Zelle is due on the rest', async () => {
    const m = await makeUser({ tag: 'zc-spend' })
    await giveCredit(m.id, 700)
    const p = await product(5000)
    const { res, body } = await placeZelle(m, p.id)
    expect(res.status, JSON.stringify(body)).toBe(200)

    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } })
    expect(order.storeCreditUsed).toBe(700)
    expect(body.storeCreditUsed).toBe(700)
    // total = everything (subtotal − discounts + shipping + tax) − credit
    expect(order.total).toBe(order.subtotal - order.discount + order.shipping + order.tax - 700)
    expect(await balance(m.id)).toBe(0)
    const lines = await prisma.storeCreditTxn.findMany({ where: { orderId: order.id } })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ type: 'CHECKOUT_APPLY', amount: -700 })
  })

  it('caps the credit at the amount due (balance larger than the order)', async () => {
    const m = await makeUser({ tag: 'zc-cap' })
    await giveCredit(m.id, 1_000_000)
    const p = await product(1000)
    const { body } = await placeZelle(m, p.id)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } })
    expect(order.total).toBe(0)
    expect(order.storeCreditUsed).toBe(order.subtotal - order.discount + order.shipping + order.tax)
    expect(await balance(m.id)).toBe(1_000_000 - order.storeCreditUsed)
  })

  it('useStoreCredit:false leaves the balance alone', async () => {
    const m = await makeUser({ tag: 'zc-off' })
    await giveCredit(m.id, 500)
    const p = await product(2000)
    const { body } = await placeZelle(m, p.id, { useStoreCredit: false })
    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } })
    expect(order.storeCreditUsed).toBe(0)
    expect(await balance(m.id)).toBe(500)
  })

  it('guest orders never touch credit', async () => {
    setSession(null)
    const p = await product(2000)
    const res = await zellePOST(
      req('/api/checkout-zelle', { body: { items: [{ productId: p.id, quantity: 1 }], email: 'zz-guest@example.invalid', shippingAddress: ADDRESS } }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.storeCreditUsed).toBe(0)
  })
})

describe('spend-more-than-balance', () => {
  it('spendCreditForOrder refuses to overdraw and writes nothing', async () => {
    const m = await makeUser({ tag: 'zc-overdraw' })
    await giveCredit(m.id, 300)
    await expect(
      prisma.$transaction((tx) => spendCreditForOrder(tx, { userId: m.id, orderId: 'zz-none', orderNumber: 'ZZ', amountCents: 301 })),
    ).rejects.toBeInstanceOf(InsufficientCreditError)
    expect(await balance(m.id)).toBe(300)
    expect(await prisma.storeCreditTxn.count({ where: { orderId: 'zz-none' } })).toBe(0)
  })

  it('two checkouts racing for the same credit: the balance never goes negative and only one spends it', async () => {
    const m = await makeUser({ tag: 'zc-race' })
    await giveCredit(m.id, 800)
    const p = await product(3000)
    const results = await Promise.all([placeZelle(m, p.id), placeZelle(m, p.id)])
    expect(await balance(m.id)).toBeGreaterThanOrEqual(0)
    const orders = await prisma.order.findMany({ where: { userId: m.id } })
    const spent = orders.reduce((s, o) => s + o.storeCreditUsed, 0)
    expect(spent).toBe(800)
    // A loser (if the race hit) was refused with 409 and left no order behind.
    for (const r of results) expect([200, 409]).toContain(r.res.status)
    const ledger = await prisma.storeCreditTxn.findMany({ where: { credit: { userId: m.id }, type: 'CHECKOUT_APPLY' } })
    expect(ledger.reduce((s, l) => s - l.amount, 0)).toBe(800)
  })
})

describe('credit comes back exactly once', () => {
  beforeEach(async () => {
    await prisma.siteSetting.deleteMany({ where: { key: 'zelle.unpaidExpiryDays' } })
  })

  it('admin cancel restores once; repeated and concurrent restores add nothing (double-restore)', async () => {
    const m = await makeUser({ tag: 'zc-cancel' })
    await giveCredit(m.id, 900)
    const p = await product(5000)
    const { body } = await placeZelle(m, p.id)
    expect(await balance(m.id)).toBe(0)

    await adminSession()
    const r1 = await orderPATCH(req(`/api/admin/orders/${body.orderId}`, { method: 'PATCH', body: { status: 'CANCELLED' } }), params({ id: body.orderId }))
    expect(r1.status).toBe(200)
    expect(await balance(m.id)).toBe(900)

    // Save the cancelled order again + three direct/concurrent restores.
    await orderPATCH(req(`/api/admin/orders/${body.orderId}`, { method: 'PATCH', body: { status: 'CANCELLED' } }), params({ id: body.orderId }))
    const again = await Promise.all([
      restoreOrderCredit(body.orderId, 'cancelled'),
      restoreOrderCredit(body.orderId, 'cancelled'),
      restoreOrderCredit(body.orderId, 'expired'),
    ])
    expect(again.map((a) => a.restored)).toEqual([0, 0, 0])
    expect(await balance(m.id)).toBe(900)
    const restores = await prisma.storeCreditTxn.findMany({ where: { orderId: body.orderId, type: 'CHECKOUT_RESTORE' } })
    expect(restores).toHaveLength(1)
    expect(restores[0].amount).toBe(900)
  })

  it('two restores racing on a freshly cancelled order return the credit once', async () => {
    const m = await makeUser({ tag: 'zc-cancel-race' })
    await giveCredit(m.id, 450)
    const p = await product(5000)
    const { body } = await placeZelle(m, p.id)
    await prisma.order.update({ where: { id: body.orderId }, data: { status: 'CANCELLED' } })
    const rs = await Promise.all([1, 2, 3, 4].map(() => restoreOrderCredit(body.orderId, 'cancelled')))
    expect(rs.reduce((s, r) => s + r.restored, 0)).toBe(450)
    expect(await balance(m.id)).toBe(450)
  })

  it('restore-on-paid: an open or PAID order gives nothing back', async () => {
    const m = await makeUser({ tag: 'zc-paid' })
    await giveCredit(m.id, 600)
    const p = await product(5000)
    const { body } = await placeZelle(m, p.id)
    expect((await restoreOrderCredit(body.orderId, 'cancelled')).restored).toBe(0) // still PENDING/UNPAID
    await adminSession()
    const paid = await markPaidPOST(req(`/api/admin/orders/${body.orderId}/mark-paid`, { method: 'POST' }), params({ id: body.orderId }))
    expect(paid.status).toBe(200)
    const r = await restoreOrderCredit(body.orderId, 'refunded')
    expect(r.restored).toBe(0)
    expect(r.skipped).toBe('order_open')
    expect(await balance(m.id)).toBe(0)
  })

  it('a full refund returns the credit; a partial refund does not', async () => {
    const m = await makeUser({ tag: 'zc-refund' })
    await giveCredit(m.id, 1000)
    const p = await product(6000)
    const { body } = await placeZelle(m, p.id)
    await adminSession()
    await markPaidPOST(req(`/api/admin/orders/${body.orderId}/mark-paid`, { method: 'POST' }), params({ id: body.orderId }))
    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } })

    const part = await refundPOST(
      req(`/api/admin/orders/${order.id}/refund`, { body: { amount: 100, reason: 'zz partial', refundMethod: 'store_credit' } }),
      params({ id: order.id }),
    )
    expect(part.status).toBe(200)
    // partial refund of $1 as store credit (REFUND line) — the spent credit stays spent
    expect(await balance(m.id)).toBe(100)

    const rest = await refundPOST(
      req(`/api/admin/orders/${order.id}/refund`, { body: { amount: order.total - 100, reason: 'zz rest', refundMethod: 'store_credit' } }),
      params({ id: order.id }),
    )
    expect(rest.status).toBe(200)
    // cash-equivalent refunded in full (as store credit) + the 1000 credit returned
    expect(await balance(m.id)).toBe(order.total + 1000)
    expect(await prisma.storeCreditTxn.count({ where: { orderId: order.id, type: 'CHECKOUT_RESTORE' } })).toBe(1)
  })

  it('mark-paid refuses a cancelled order whose credit was returned', async () => {
    const m = await makeUser({ tag: 'zc-markpaid' })
    await giveCredit(m.id, 250)
    const p = await product(4000)
    const { body } = await placeZelle(m, p.id)
    await adminSession()
    await orderPATCH(req(`/api/admin/orders/${body.orderId}`, { method: 'PATCH', body: { status: 'CANCELLED' } }), params({ id: body.orderId }))
    const r = await markPaidPOST(req(`/api/admin/orders/${body.orderId}/mark-paid`, { method: 'POST' }), params({ id: body.orderId }))
    expect(r.status).toBe(409)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } })).paymentStatus).toBe('UNPAID')
  })
})

describe('unpaid Zelle orders expire (stale-zelle cron) and return credit', () => {
  beforeEach(async () => {
    await prisma.siteSetting.deleteMany({ where: { key: 'zelle.unpaidExpiryDays' } })
  })

  it('cancels only unpaid, non-membership Zelle orders older than the window; dry run changes nothing; re-run is a no-op', async () => {
    const m = await makeUser({ tag: 'zc-expire' })
    await giveCredit(m.id, 400)
    const p = await product(5000)
    const { body } = await placeZelle(m, p.id)
    const { body: fresh } = await placeZelle(m, p.id, { useStoreCredit: false })
    const { body: paid } = await placeZelle(m, p.id, { useStoreCredit: false })
    const { body: membershipInvoice } = await placeZelle(m, p.id, { useStoreCredit: false })
    const old = new Date(Date.now() - 20 * 86400e3)
    await prisma.order.updateMany({ where: { id: { in: [body.orderId, paid.orderId, membershipInvoice.orderId] } }, data: { createdAt: old } })
    await prisma.order.update({ where: { id: paid.orderId }, data: { paymentStatus: 'PAID', status: 'PROCESSING' } })
    await prisma.order.update({ where: { id: membershipInvoice.orderId }, data: { notes: 'MEMBERSHIP:zz:PLUS' } })

    const dry = await expireUnpaidZelleOrders({ dryRun: true })
    expect(dry.orders.map((o) => o.outcome)).toContain('would_expire')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } })).status).toBe('PENDING')
    expect(await balance(m.id)).toBe(0)

    const run = await expireUnpaidZelleOrders()
    expect(run.expiryDays).toBe(14)
    const byId = async (id: string) => prisma.order.findUniqueOrThrow({ where: { id } })
    expect((await byId(body.orderId)).status).toBe('CANCELLED')
    expect((await byId(fresh.orderId)).status).toBe('PENDING') // too young
    expect((await byId(paid.orderId)).status).toBe('PROCESSING') // paid
    expect((await byId(membershipInvoice.orderId)).status).toBe('PENDING') // membership lifecycle owns it
    expect(await balance(m.id)).toBe(400)

    const rerun = await expireUnpaidZelleOrders()
    expect(rerun.orders.find((o) => o.orderNumber === body.orderNumber)).toBeUndefined()
    expect(await balance(m.id)).toBe(400)
  })

  it('setting 0 turns expiry off', async () => {
    await prisma.siteSetting.create({ data: { key: 'zelle.unpaidExpiryDays', value: '0' } })
    const r = await expireUnpaidZelleOrders()
    expect(r.expiryDays).toBe(0)
    expect(r.orders).toHaveLength(0)
  })
})
