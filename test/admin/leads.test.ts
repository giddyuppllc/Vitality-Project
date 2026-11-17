import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST as convert } from '@/app/api/admin/leads/[id]/convert/route'
import { PATCH as orgPATCH } from '@/app/api/admin/organizations/[id]/route'
import { fakeEmail, makeUser, params, req, setSession } from '../helpers'

describe('admin lead -> organization', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'lead-admin', role: 'ADMIN' })
  })

  it('a converted lead owner gets an activation link when the org is approved', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const lead = await prisma.salesLead.create({
      data: { businessName: `ZZ-TEST Gym ${Date.now().toString(36)}`, contactName: 'ZZ Owner', contactEmail: fakeEmail('lead-owner') },
    })
    const res = await convert(req('http://localhost/x', { method: 'POST', body: { type: 'GYM' } }), params({ id: lead.id }))
    expect(res.status).toBe(200)
    const { organization } = await res.json()

    const approve = await orgPATCH(req('http://localhost/x', { method: 'PATCH', body: { status: 'ACTIVE' } }), params({ id: organization.id }))
    expect(approve.status).toBe(200)
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: lead.contactEmail.toLowerCase() } })
    expect(owner.resetToken).toBeTruthy() // activation link issued
    expect(owner.passwordHash).toBeNull()
  })
})
