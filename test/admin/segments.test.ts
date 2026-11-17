import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST as preview } from '@/app/api/admin/segments/preview/route'
import { makeUser, req, setSession } from '../helpers'

describe('admin segment preview', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'seg-admin', role: 'ADMIN' })
  })

  it('counts matching customers without creating or changing any saved segment', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const tag = await prisma.tag.create({ data: { name: `zz-seg-${Date.now().toString(36)}` } })
    const u = await makeUser({ tag: 'seg-member' })
    await prisma.userTag.create({ data: { userId: u.id, tagId: tag.id } })
    const before = await prisma.savedSegment.count()
    const audits = await prisma.auditLog.count()
    const res = await preview(req('http://localhost/x', { method: 'POST', body: { filters: { tagIds: [tag.id] } } }))
    expect(res.status).toBe(200)
    expect((await res.json()).total).toBe(1)
    expect(await prisma.savedSegment.count()).toBe(before)
    expect(await prisma.auditLog.count()).toBe(audits)
  })
})
