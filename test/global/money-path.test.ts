import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST as zellePOST } from '@/app/api/checkout-zelle/route'
import { POST as cardPOST } from '@/app/api/checkout/route'
import { PATCH as orderPATCH } from '@/app/api/admin/orders/[id]/route'
import { POST as refundPOST } from '@/app/api/admin/orders/[id]/refund/route'
import { POST as markPaidPOST } from '@/app/api/admin/orders/[id]/mark-paid/route'
import { POST as subscribePOST } from '@/app/api/membership/subscribe/route'
import { makeUser, params, req, setSession } from '../helpers'

/**
 * Money-path review (checkout, credit, points, coupons, mark-paid, refunds,
 * membership invoices, affiliates). Each block reproduces a bug found in the
 * review against the real route handlers. Fixtures are fake (ZZ-TEST products,
 * zz-*@example.invalid users) and exist only in the throwaway PGlite DB.
 */

const ADDRESS = { name: 'ZZ Test', line1: '1 Test St', city: 'Testville', state: 'AZ', zip: '85001', country: 'US' }
const CARD = { number: '4111111111111111', expMonth: '12', expYear: '2035', cvv: '123', name: 'ZZ Test', zip: '85001' }

async function product(priceCents: number, extra: Record<string, unknown> = {}) {
  return prisma.product.create({
    data: {
      name: 'ZZ-TEST money fixture',
      description: 'Test fixture (throwaway DB only)',
      slug: `zz-test-money-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      price: priceCents,
      status: 'ACTIVE',
      trackInventory: false,
      ...extra,
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

async function givePoints(userId: string, points: number) {
  await prisma.loyaltyAccount.upsert({
    where: { userId },
    update: { points: { increment: points } },
    create: { userId, points },
  })
}

const creditBalance = async (userId: string) => (await prisma.storeCredit.findUnique({ where: { userId } }))?.balance ?? 0
const pointsBalance = async (userId: string) => (await prisma.loyaltyAccount.findUnique({ where: { userId } }))?.points ?? 0

function zelleReq(user: { email: string }, items: unknown[], extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return req('/api/checkout-zelle', { body: { items, email: user.email, shippingAddress: ADDRESS, ...extra }, headers })
}

function cardReq(user: { email: string }, items: unknown[], extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return req('/api/checkout', { body: { items, email: user.email, shippingAddress: ADDRESS, card: CARD, ...extra }, headers })
}

async function adminSession() {
  const admin = await makeUser({ tag: 'mp-admin', role: 'ADMIN' })
  setSession({ ...admin, role: 'ADMIN' })
  return admin
}

let codeSeq = 0
async function discountCode(data: Record<string, unknown>, rule?: Record<string, unknown>) {
  codeSeq += 1
  return prisma.discountCode.create({
    data: {
      code: `ZZMP${Date.now().toString(36).toUpperCase()}${codeSeq}`,
      type: 'PERCENTAGE',
      value: 10,
      ...data,
      ...(rule ? { rule: { create: rule } } : {}),
    } as Parameters<typeof prisma.discountCode.create>[0]['data'],
  })
}

describe('card checkout: store credit and points cannot be double-spent', () => {
  it('two simultaneous card checkouts against the same credit never overdraw it', async () => {
    const m = await makeUser({ tag: 'mp-card-race' })
    await giveCredit(m.id, 5000)
    const p = await product(4000)
    setSession(m)
    const results = await Promise.all(
      [1, 2, 3].map(() => cardPOST(cardReq(m, [{ productId: p.id, quantity: 1 }], { useStoreCredit: true }))),
    )
    const bodies = await Promise.all(results.map((r) => r.json()))
    const orders = await prisma.order.findMany({ where: { userId: m.id } })
    const spentOnOrders = orders.reduce((s, o) => s + o.storeCreditUsed, 0)
    const bal = await creditBalance(m.id)
    expect(bal, JSON.stringify(bodies)).toBeGreaterThanOrEqual(0)
    // Every cent of credit an order claims was actually debited from the balance.
    expect(spentOnOrders + bal).toBe(5000)
    // Each order's card charge + credit covers its price (nobody got a free discount).
    for (const o of orders) {
      expect(o.total + o.storeCreditUsed).toBe(o.subtotal - o.discount + o.shipping + o.tax)
    }
  })

  it('two simultaneous card checkouts against the same loyalty points never overdraw them', async () => {
    const m = await makeUser({ tag: 'mp-card-pts' })
    await givePoints(m.id, 4000)
    const p = await product(4000)
    setSession(m)
    await Promise.all(
      [1, 2, 3].map(() => cardPOST(cardReq(m, [{ productId: p.id, quantity: 1 }], { useLoyaltyPoints: 4000 }))),
    )
    const orders = await prisma.order.findMany({ where: { userId: m.id } })
    const used = orders.reduce((s, o) => s + o.loyaltyPointsUsed, 0)
    const pts = await pointsBalance(m.id)
    expect(pts).toBeGreaterThanOrEqual(0)
    // Points earned on the orders are added back; spent points must match.
    const earned = orders.reduce((s, o) => s + o.loyaltyPointsEarned, 0)
    expect(used + pts - earned).toBe(4000)
  })

  it('refuses a fractional quantity (would price a line at a fraction of a cent)', async () => {
    const m = await makeUser({ tag: 'mp-card-frac' })
    const p = await product(999)
    setSession(m)
    const r = await cardPOST(cardReq(m, [{ productId: p.id, quantity: 1.5 }]))
    expect(r.status).toBe(400)
    expect(await prisma.order.count({ where: { userId: m.id } })).toBe(0)
  })

  it('refuses an empty cart', async () => {
    const m = await makeUser({ tag: 'mp-card-empty' })
    setSession(m)
    const r = await cardPOST(cardReq(m, []))
    expect(r.status).toBe(400)
  })
})

describe('variants are priced from the variant the customer chose', () => {
  it('an unknown / other-product variantId is refused, not sold at the base price', async () => {
    const m = await makeUser({ tag: 'mp-variant' })
    const a = await product(1000, { variants: { create: [{ name: 'ZZ 10mg', price: 9000, sku: `ZZ-V-${Date.now()}` }] } })
    const b = await product(500, { variants: { create: [{ name: 'ZZ 50mg', price: 50000, sku: `ZZ-W-${Date.now()}` }] } })
    const bVariant = await prisma.productVariant.findFirstOrThrow({ where: { productId: b.id } })
    setSession(m)
    const z = await zellePOST(zelleReq(m, [{ productId: a.id, variantId: bVariant.id, quantity: 1 }]))
    expect(z.status).toBe(400)
    setSession(m)
    const c = await cardPOST(cardReq(m, [{ productId: a.id, variantId: 'zz-no-such-variant', quantity: 1 }]))
    expect(c.status).toBe(400)
    expect(await prisma.order.count({ where: { userId: m.id } })).toBe(0)
  })
})

describe('member pricing never discounts more than the merchandise', () => {
  it('free-peptide credits + bundle discount: the order discount is capped at the subtotal', async () => {
    const cat = await prisma.category.upsert({
      where: { slug: 'weight-loss' },
      update: {},
      create: { slug: 'weight-loss', name: 'ZZ-TEST weight-loss' },
    })
    const m = await makeUser({ tag: 'mp-overshoot', tier: 'PREMIUM' })
    await prisma.membership.update({ where: { userId: m.id }, data: { freePeptideCreditsThisPeriod: 3, freePeptidesUsedThisPeriod: 0 } })
    const a = await product(10000, { categoryId: cat.id })
    const b = await product(8000, { categoryId: cat.id })
    setSession(m)
    const r = await zellePOST(zelleReq(m, [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 }], { useStoreCredit: false }))
    const body = await r.json()
    expect(r.status, JSON.stringify(body)).toBe(200)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } })
    expect(order.subtotal).toBe(18000)
    expect(order.discount).toBeLessThanOrEqual(order.subtotal)
    expect(order.total).toBe(0)
  })
})

describe('free-peptide credits cannot be double-spent', () => {
  for (const path of ['zelle', 'card'] as const) {
    it(`${path}: simultaneous orders get one free peptide per credit, no more`, async () => {
      const m = await makeUser({ tag: `mp-pepcred-${path}`, tier: 'PLUS' })
      await prisma.membership.update({ where: { userId: m.id }, data: { freePeptideCreditsThisPeriod: 1, freePeptidesUsedThisPeriod: 0 } })
      const p = await product(10000)
      setSession(m)
      await Promise.all(
        [1, 2, 3].map(() =>
          path === 'zelle'
            ? zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { useStoreCredit: false }))
            : cardPOST(cardReq(m, [{ productId: p.id, quantity: 1 }])),
        ),
      )
      const mem = await prisma.membership.findUniqueOrThrow({ where: { userId: m.id } })
      expect(mem.freePeptidesUsedThisPeriod).toBeLessThanOrEqual(1)
      const orders = await prisma.order.findMany({ where: { userId: m.id } })
      // Credited units are discounted to $0: at most one order may have had that.
      expect(orders.filter((o) => o.discount >= 10000).length).toBeLessThanOrEqual(1)
    })
  }
})

describe('Zelle checkout: loyalty points cannot be double-spent', () => {
  it('two simultaneous Zelle orders redeeming the same points: the discount is only given once', async () => {
    const m = await makeUser({ tag: 'mp-zelle-pts' })
    await givePoints(m.id, 3000)
    const p = await product(5000)
    setSession(m)
    await Promise.all(
      [1, 2, 3].map(() => zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { loyaltyPointsToRedeem: 3000, useStoreCredit: false }))),
    )
    const orders = await prisma.order.findMany({ where: { userId: m.id } })
    const usedOnOrders = orders.reduce((s, o) => s + o.loyaltyPointsUsed, 0)
    const pts = await pointsBalance(m.id)
    expect(pts).toBeGreaterThanOrEqual(0)
    expect(usedOnOrders + pts).toBe(3000)
  })
})

describe('discount codes honour their rules', () => {
  afterEach(async () => {
    await prisma.shippingZone.deleteMany({ where: { name: 'ZZ-TEST zone' } })
  })

  it('a code below its minimum order is refused, not silently applied', async () => {
    const m = await makeUser({ tag: 'mp-code-min' })
    const p = await product(2000)
    const code = await discountCode({ type: 'FIXED', value: 1500, minOrder: 10000 })
    setSession(m)
    const r = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { discountCode: code.code }))
    expect(r.status).toBe(400)
    expect(await prisma.order.count({ where: { userId: m.id } })).toBe(0)
    expect((await prisma.discountCode.findUniqueOrThrow({ where: { id: code.id } })).usedCount).toBe(0)
  })

  it('a code restricted to other products is refused', async () => {
    const m = await makeUser({ tag: 'mp-code-prod' })
    const p = await product(2000)
    const other = await product(3000)
    const code = await discountCode({ type: 'PERCENTAGE', value: 50 }, { productIds: [other.id] })
    setSession(m)
    const r = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { discountCode: code.code }))
    expect(r.status).toBe(400)
  })

  it('uses-per-customer cannot be bypassed by typing the code in lower case', async () => {
    const m = await makeUser({ tag: 'mp-code-upc' })
    const p = await product(2000)
    const code = await discountCode({ type: 'PERCENTAGE', value: 10 }, { usesPerCustomer: 1 })
    setSession(m)
    const first = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { discountCode: code.code.toLowerCase() }))
    expect(first.status).toBe(200)
    const second = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { discountCode: code.code.toLowerCase() }))
    expect(second.status).toBe(400)
    const orders = await prisma.order.findMany({ where: { userId: m.id } })
    expect(orders).toHaveLength(1)
    expect(orders[0].discountCode).toBe(code.code)
  })

  it('a FREE_SHIPPING code waives shipping instead of taking its value off as cash', async () => {
    await prisma.shippingZone.create({
      data: { name: 'ZZ-TEST zone', countries: ['US'], rates: { create: [{ name: 'ZZ Standard', price: 900 }] } },
    })
    const m = await makeUser({ tag: 'mp-code-ship' })
    const p = await product(2000)
    const code = await discountCode({ type: 'FREE_SHIPPING', value: 5000 })
    setSession(m)
    const r = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { discountCode: code.code }))
    const body = await r.json()
    expect(r.status, JSON.stringify(body)).toBe(200)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } })
    expect(order.shipping).toBe(0)
    expect(order.discount).toBe(0)
  })

  it('the card checkout enforces the same rules', async () => {
    const m = await makeUser({ tag: 'mp-code-card' })
    const p = await product(2000)
    const code = await discountCode({ type: 'FIXED', value: 1500, minOrder: 10000 })
    setSession(m)
    const r = await cardPOST(cardReq(m, [{ productId: p.id, quantity: 1 }], { discountCode: code.code }))
    expect(r.status).toBe(400)
  })

  it('an unknown code (e.g. an affiliate code) is still not an error', async () => {
    const m = await makeUser({ tag: 'mp-code-unknown' })
    const p = await product(2000)
    setSession(m)
    const r = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { discountCode: 'ZZNOSUCHCODE' }))
    expect(r.status).toBe(200)
  })
})

describe('mark-paid runs its pipeline exactly once', () => {
  it('two simultaneous mark-paid calls decrement stock and award points once', async () => {
    const m = await makeUser({ tag: 'mp-markpaid-race' })
    const p = await product(3000, { inventory: 10, trackInventory: true })
    setSession(m)
    const placed = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 2 }], { useStoreCredit: false }))
    const { orderId } = await placed.json()
    await adminSession()
    const rs = await Promise.all(
      [1, 2, 3].map(() => markPaidPOST(req(`/api/admin/orders/${orderId}/mark-paid`, { method: 'POST' }), params({ id: orderId }))),
    )
    expect(rs.every((r) => r.status === 200)).toBe(true)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).inventory).toBe(8)
    expect(await prisma.loyaltyTransaction.count({ where: { orderId, type: 'EARN_PURCHASE' } })).toBe(1)
  })

  it('a cancelled order whose credit was returned cannot be re-opened and marked paid', async () => {
    const m = await makeUser({ tag: 'mp-reopen' })
    await giveCredit(m.id, 500)
    const p = await product(4000)
    setSession(m)
    const placed = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }]))
    const { orderId } = await placed.json()
    await adminSession()
    await orderPATCH(req(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { status: 'CANCELLED' } }), params({ id: orderId }))
    expect(await creditBalance(m.id)).toBe(500)
    // Admin re-opens it ("Mark Processing"), then marks it paid.
    await orderPATCH(req(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { status: 'PROCESSING' } }), params({ id: orderId }))
    const r = await markPaidPOST(req(`/api/admin/orders/${orderId}/mark-paid`, { method: 'POST' }), params({ id: orderId }))
    expect(r.status).toBe(409)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe('UNPAID')
  })

  it('the generic order PATCH cannot mark that order paid either', async () => {
    const m = await makeUser({ tag: 'mp-patchpaid' })
    await giveCredit(m.id, 500)
    const p = await product(4000)
    setSession(m)
    const placed = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }]))
    const { orderId } = await placed.json()
    await adminSession()
    await orderPATCH(req(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { status: 'CANCELLED' } }), params({ id: orderId }))
    const r = await orderPATCH(req(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { paymentStatus: 'PAID' } }), params({ id: orderId }))
    expect(r.status).toBe(409)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe('UNPAID')
  })
})

describe('refunds', () => {
  it('an unpaid order cannot be refunded (store credit for money never received)', async () => {
    const m = await makeUser({ tag: 'mp-refund-unpaid' })
    const p = await product(4000)
    setSession(m)
    const placed = await zellePOST(zelleReq(m, [{ productId: p.id, quantity: 1 }], { useStoreCredit: false }))
    const { orderId } = await placed.json()
    await adminSession()
    const r = await refundPOST(
      req(`/api/admin/orders/${orderId}/refund`, { body: { amount: 1000, reason: 'zz', refundMethod: 'store_credit' } }),
      params({ id: orderId }),
    )
    expect(r.status).toBe(400)
    expect(await creditBalance(m.id)).toBe(0)
  })
})

describe('membership invoices', () => {
  async function markPaid(orderId: string) {
    await adminSession()
    return markPaidPOST(req(`/api/admin/orders/${orderId}/mark-paid`, { method: 'POST' }), params({ id: orderId }))
  }

  it('paying the cheaper of two open invoices activates the tier that was paid for', async () => {
    const m = await makeUser({ tag: 'mp-mem-switch' })
    setSession(m)
    const club = await (await subscribePOST(req('/api/membership/subscribe', { body: { tier: 'CLUB' } }))).json()
    setSession(m)
    const premium = await (await subscribePOST(req('/api/membership/subscribe', { body: { tier: 'PREMIUM' } }))).json()
    expect(premium.orderNumber).not.toBe(club.orderNumber)
    const clubOrder = await prisma.order.findUniqueOrThrow({ where: { orderNumber: club.orderNumber } })
    expect(clubOrder.total).toBe(2500)
    const r = await markPaid(clubOrder.id)
    expect(r.status).toBe(200)
    const mem = await prisma.membership.findUniqueOrThrow({ where: { userId: m.id } })
    expect(mem.status).toBe('ACTIVE')
    expect(mem.tier).toBe('CLUB')
    expect(mem.monthlyPriceCents).toBe(2500)
  })

  it('an active member who starts a tier change keeps the tier they paid for until the new invoice is paid', async () => {
    const m = await makeUser({ tag: 'mp-mem-upgrade', tier: 'PLUS' })
    await prisma.membership.update({
      where: { userId: m.id },
      data: { monthlyPriceCents: 15000, renewsAt: new Date(Date.now() + 20 * 86400e3), paymentConfirmedAt: new Date() },
    })
    setSession(m)
    const res = await subscribePOST(req('/api/membership/subscribe', { body: { tier: 'PREMIUM' } }))
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    let mem = await prisma.membership.findUniqueOrThrow({ where: { userId: m.id } })
    expect(mem.status).toBe('ACTIVE')
    expect(mem.tier).toBe('PLUS')
    const inv = await prisma.order.findUniqueOrThrow({ where: { orderNumber: body.orderNumber } })
    expect(inv.total).toBe(25000)
    await markPaid(inv.id)
    mem = await prisma.membership.findUniqueOrThrow({ where: { userId: m.id } })
    expect(mem.status).toBe('ACTIVE')
    expect(mem.tier).toBe('PREMIUM')
    expect(mem.monthlyPriceCents).toBe(25000)
  })
})

describe('affiliate commissions', () => {
  it('an affiliate earns nothing on their own order (cookie or typed code)', async () => {
    const affUser = await makeUser({ tag: 'mp-aff-self' })
    const aff = await prisma.affiliate.create({
      data: { userId: affUser.id, code: `ZZAFF${Date.now().toString(36).toUpperCase()}`, status: 'ACTIVE', commissionRate: 0.1 },
    })
    const p = await product(10000)
    setSession(affUser)
    const z1 = await (await zellePOST(zelleReq(affUser, [{ productId: p.id, quantity: 1 }], { discountCode: aff.code }))).json()
    setSession(affUser)
    const z2 = await (
      await zellePOST(zelleReq(affUser, [{ productId: p.id, quantity: 1 }], {}, { cookie: `aff_code=${aff.code}` }))
    ).json()
    for (const id of [z1.orderId, z2.orderId]) {
      expect((await prisma.order.findUniqueOrThrow({ where: { id } })).affiliateId).toBeNull()
    }
    setSession(affUser)
    const c = await cardPOST(cardReq(affUser, [{ productId: p.id, quantity: 1 }], {}, { cookie: `aff_code=${aff.code}` }))
    expect(c.status).toBe(200)
    expect(await prisma.affiliateCommission.count({ where: { affiliateId: aff.id } })).toBe(0)
  })

  it('a different customer still credits the affiliate', async () => {
    const affUser = await makeUser({ tag: 'mp-aff-ok' })
    const aff = await prisma.affiliate.create({
      data: { userId: affUser.id, code: `ZZAFO${Date.now().toString(36).toUpperCase()}`, status: 'ACTIVE', commissionRate: 0.1 },
    })
    const buyer = await makeUser({ tag: 'mp-aff-buyer' })
    const p = await product(10000)
    setSession(buyer)
    const z = await (await zellePOST(zelleReq(buyer, [{ productId: p.id, quantity: 1 }], { discountCode: aff.code }))).json()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: z.orderId } })).affiliateId).toBe(aff.id)
  })
})
