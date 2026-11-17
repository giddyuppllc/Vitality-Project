import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { PATCH as commissionPATCH } from '@/app/api/admin/affiliates/commissions/[id]/route'
import { POST as payoutPOST } from '@/app/api/admin/affiliates/[id]/payout/route'
import { makeUser, params, req, setSession } from '../helpers'

const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

async function fixture(paymentStatus: 'PAID' | 'UNPAID' | 'REFUNDED') {
  const u = await makeUser({ tag: 'aff' })
  const aff = await prisma.affiliate.create({ data: { userId: u.id, code: `ZZ${uniq().toUpperCase()}`, status: 'ACTIVE', totalEarned: 500 } })
  const order = await prisma.order.create({
    data: { orderNumber: `ZZ-AFF-${uniq()}`, email: u.email, subtotal: 5000, total: 5000, paymentStatus, affiliateId: aff.id },
  })
  const c = await prisma.affiliateCommission.create({ data: { affiliateId: aff.id, orderId: order.id, amount: 500, status: 'PENDING' } })
  return { aff, order, c }
}

describe('admin affiliate commissions → payout', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'aff-admin', role: 'ADMIN' })
  })
  const asAdmin = () => setSession({ ...admin, role: 'ADMIN' })
  const patch = (id: string, action: string) =>
    commissionPATCH(req('http://localhost/x', { method: 'PATCH', body: { action } }), params({ id }))
  const payout = (affId: string) =>
    payoutPOST(req('http://localhost/x', { method: 'POST', body: { method: 'manual' } }), params({ id: affId }))

  it('a PENDING commission on a paid order can be approved and then paid out', async () => {
    asAdmin()
    const { aff, c } = await fixture('PAID')
    // before: nothing approved -> payout impossible (the original dead end)
    expect((await payout(aff.id)).status).toBe(400)
    expect((await patch(c.id, 'approve')).status).toBe(200)
    expect((await patch(c.id, 'approve')).status).toBe(409) // double click
    const res = await payout(aff.id)
    expect(res.status).toBe(200)
    expect((await prisma.affiliateCommission.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('PAID')
    expect(await prisma.auditLog.count({ where: { action: 'affiliate.commission.approve', entityId: c.id } })).toBe(1)
  })

  it('refuses to approve a commission on an unpaid or refunded order', async () => {
    asAdmin()
    for (const ps of ['UNPAID', 'REFUNDED'] as const) {
      const { c } = await fixture(ps)
      expect((await patch(c.id, 'approve')).status).toBe(409)
    }
  })

  it('cancel removes it from the payable balance and from lifetime earned', async () => {
    asAdmin()
    const { aff, c } = await fixture('PAID')
    expect((await patch(c.id, 'cancel')).status).toBe(200)
    expect((await prisma.affiliate.findUniqueOrThrow({ where: { id: aff.id } })).totalEarned).toBe(0)
    expect((await patch(c.id, 'cancel')).status).toBe(409)
  })
})
