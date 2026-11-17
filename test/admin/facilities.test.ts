import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from '@/app/api/admin/facilities/[id]/route'
import { makeUser, params, req, setSession } from '../helpers'

const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

async function facility() {
  return prisma.facility.create({
    data: {
      name: 'ZZ-TEST Facility',
      slug: `zz-test-fac-${uniq()}`,
      email: 'zz-fac@example.invalid',
      addressLine1: '1 Test St',
      city: 'Testville',
      zip: '00000',
    },
  })
}

describe('admin facilities', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'fac-admin', role: 'ADMIN' })
  })

  it('saving the API key never writes it into the audit log', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const f = await facility()
    const secret = `zz-secret-${uniq()}`
    const res = await PATCH(
      req(`http://localhost/api/admin/facilities/${f.id}`, { method: 'PATCH', body: { name: 'ZZ-TEST Facility 2', apiKey: secret } }),
      params({ id: f.id }),
    )
    expect(res.status).toBe(200)
    expect((await prisma.facility.findUniqueOrThrow({ where: { id: f.id } })).apiKey).toBe(secret)
    const logs = await prisma.auditLog.findMany({ where: { entityId: f.id } })
    expect(logs.length).toBeGreaterThan(0)
    expect(JSON.stringify(logs)).not.toContain(secret)
  })

  it('deleting a facility with only finished fulfillments gives a clear 409, not a 500', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const f = await facility()
    const order = await prisma.order.create({
      data: { orderNumber: `ZZ-FAC-${uniq()}`, email: 'zz-o@example.invalid', subtotal: 100, total: 100 },
    })
    await prisma.fulfillment.create({ data: { orderId: order.id, facilityId: f.id, status: 'DELIVERED' } })
    const res = await DELETE(req(`http://localhost/api/admin/facilities/${f.id}`, { method: 'DELETE' }), params({ id: f.id }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/Active/)
  })
})
