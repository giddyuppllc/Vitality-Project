import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/admin/discounts/route'
import { PATCH } from '@/app/api/admin/discounts/[id]/route'
import { makeUser, params, req, setSession } from '../helpers'

const code = () => `ZZT${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`

describe('admin discounts', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'disc-admin', role: 'ADMIN' })
  })
  const asAdmin = () => setSession({ ...admin, role: 'ADMIN' })
  const create = (body: Record<string, unknown>) =>
    POST(req('http://localhost/api/admin/discounts', { method: 'POST', body }))

  it('a coupon set to expire on a date is still valid through the end of that date (UTC)', async () => {
    asAdmin()
    const res = await create({ code: code(), type: 'FIXED', value: 500, expiresAt: '2030-12-31' })
    expect(res.status).toBe(201)
    const c = await res.json()
    const exp = new Date(c.expiresAt)
    expect(exp.toISOString()).toBe('2030-12-31T23:59:59.999Z')
  })

  it('refuses a percentage over 100 (create and edit)', async () => {
    asAdmin()
    const res = await create({ code: code(), type: 'PERCENTAGE', value: 150 })
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
    const ok = await (await create({ code: code(), type: 'PERCENTAGE', value: 20 })).json()
    const patch = await PATCH(
      req(`http://localhost/api/admin/discounts/${ok.id}`, { method: 'PATCH', body: { value: 150 } }),
      params({ id: ok.id }),
    )
    expect(patch.status).toBe(400)
    expect((await prisma.discountCode.findUniqueOrThrow({ where: { id: ok.id } })).value).toBe(20)
  })

  it('renaming onto an existing code is a 409, not a 500', async () => {
    asAdmin()
    const a = await (await create({ code: code(), type: 'FIXED', value: 100 })).json()
    const b = await (await create({ code: code(), type: 'FIXED', value: 100 })).json()
    const res = await PATCH(
      req(`http://localhost/api/admin/discounts/${b.id}`, { method: 'PATCH', body: { code: a.code } }),
      params({ id: b.id }),
    )
    expect(res.status).toBe(409)
  })
})
