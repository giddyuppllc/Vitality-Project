import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST as variantPOST } from '@/app/api/admin/products/[id]/variants/route'
import { PATCH as variantPATCH, DELETE as variantDELETE } from '@/app/api/admin/products/[id]/variants/[variantId]/route'
import { POST as zonePOST } from '@/app/api/admin/shipping/zones/route'
import { POST as ratePOST } from '@/app/api/admin/shipping/rates/route'
import { PATCH as ratePATCH, DELETE as rateDELETE } from '@/app/api/admin/shipping/rates/[id]/route'
import { PATCH as fulfillmentPATCH } from '@/app/api/admin/fulfillments/[id]/route'
import { makeUser, params, req, setSession } from '../helpers'

/** Money- and customer-affecting admin actions must leave an audit row. */
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

describe('admin audit coverage', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'audit-admin', role: 'ADMIN' })
  })
  const asAdmin = () => setSession({ ...admin, role: 'ADMIN' })
  const actions = async () =>
    (await prisma.auditLog.findMany({ where: { userId: admin.id }, select: { action: true } })).map((a) => a.action)

  it('variant create / price change / delete are audited (with before/after price)', async () => {
    asAdmin()
    const p = await prisma.product.create({
      data: { name: `ZZ-TEST var ${uniq()}`, slug: `zz-test-var-${uniq()}`, description: 'x', price: 1000 },
    })
    const v = await (
      await variantPOST(
        req('http://localhost/x', { method: 'POST', body: { name: '10mg', price: 1000, inventory: 3 } }),
        params({ id: p.id }),
      )
    ).json()
    await variantPATCH(req('http://localhost/x', { method: 'PATCH', body: { price: 1500 } }), params({ id: p.id, variantId: v.id }))
    await variantDELETE(req('http://localhost/x', { method: 'DELETE' }), params({ id: p.id, variantId: v.id }))
    const a = await actions()
    expect(a).toEqual(expect.arrayContaining(['product.variant.create', 'product.variant.update', 'product.variant.delete']))
    const upd = await prisma.auditLog.findFirst({ where: { action: 'product.variant.update', entityId: p.id } })
    expect(JSON.parse(String(upd!.metadata)).changes.price).toEqual({ from: 1000, to: 1500 })
  })

  it("a variant can't be edited through another product's URL", async () => {
    asAdmin()
    const p1 = await prisma.product.create({ data: { name: `ZZ-TEST a ${uniq()}`, slug: `zz-a-${uniq()}`, description: 'x', price: 1 } })
    const p2 = await prisma.product.create({ data: { name: `ZZ-TEST b ${uniq()}`, slug: `zz-b-${uniq()}`, description: 'x', price: 1 } })
    const v = await prisma.productVariant.create({ data: { productId: p1.id, name: 'x', price: 100 } })
    const res = await variantPATCH(req('http://localhost/x', { method: 'PATCH', body: { price: 1 } }), params({ id: p2.id, variantId: v.id }))
    expect(res.status).toBe(404)
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: v.id } })).price).toBe(100)
  })

  it('shipping zone/rate changes are audited', async () => {
    asAdmin()
    const zone = await (await zonePOST(req('http://localhost/x', { method: 'POST', body: { name: `ZZ zone ${uniq()}`, countries: ['ZZ'] } }))).json()
    const rate = await (await ratePOST(req('http://localhost/x', { method: 'POST', body: { zoneId: zone.id, name: 'ZZ rate', price: 995 } }))).json()
    await ratePATCH(req('http://localhost/x', { method: 'PATCH', body: { price: 0 } }), params({ id: rate.id }))
    await rateDELETE(req('http://localhost/x', { method: 'DELETE' }), params({ id: rate.id }))
    expect(await actions()).toEqual(
      expect.arrayContaining(['shipping.zone.create', 'shipping.rate.create', 'shipping.rate.update', 'shipping.rate.delete']),
    )
  })

  it('fulfillment edits are audited; an unknown id is a 404 not a 500', async () => {
    asAdmin()
    const missing = await fulfillmentPATCH(req('http://localhost/x', { method: 'PATCH', body: { notes: 'x' } }), params({ id: 'zz-nope' }))
    expect(missing.status).toBe(404)
    const fac = await prisma.facility.create({
      data: { name: 'ZZ fac', slug: `zz-fac-${uniq()}`, email: 'zz@example.invalid', addressLine1: '1', city: 'x', zip: '0' },
    })
    const order = await prisma.order.create({ data: { orderNumber: `ZZ-F-${uniq()}`, email: 'zz@example.invalid', subtotal: 1, total: 1 } })
    const f = await prisma.fulfillment.create({ data: { orderId: order.id, facilityId: fac.id } })
    const res = await fulfillmentPATCH(req('http://localhost/x', { method: 'PATCH', body: { notes: 'zz packed' } }), params({ id: f.id }))
    expect(res.status).toBe(200)
    expect(await actions()).toContain('fulfillment.update')
  })
})
