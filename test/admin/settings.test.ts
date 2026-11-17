import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/admin/settings/route'
import { makeUser, req, setSession } from '../helpers'

describe('admin settings', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'settings-admin', role: 'ADMIN' })
  })

  it('refuses keys the Settings page does not edit (internal markers, tax overrides)', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const res = await POST(req('http://localhost/api/admin/settings', { method: 'POST', body: { 'taxRate.AZ': '0' } }))
    expect(res.status).toBe(400)
    expect(await prisma.siteSetting.findUnique({ where: { key: 'taxRate.AZ' } })).toBeNull()
  })

  it('a change to the Zelle destination saves and is audit-logged with before/after', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    await POST(req('http://localhost/api/admin/settings', { method: 'POST', body: { zelleEmail: 'zz-old@example.invalid' } }))
    const res = await POST(
      req('http://localhost/api/admin/settings', { method: 'POST', body: { zelleEmail: 'zz-new@example.invalid', achAccount: '123456789' } }),
    )
    expect(res.status).toBe(200)
    const saved = await (await GET()).json()
    expect(saved.zelleEmail).toBe('zz-new@example.invalid')
    const log = await prisma.auditLog.findFirst({
      where: { action: 'settings.update', userId: admin.id },
      orderBy: { createdAt: 'desc' },
    })
    expect(log).not.toBeNull()
    const meta = JSON.parse(String(log!.metadata))
    expect(meta.changes).toContainEqual({ key: 'zelleEmail', from: 'zz-old@example.invalid', to: 'zz-new@example.invalid' })
    // bank account numbers are masked in the trail
    expect(JSON.stringify(meta)).not.toContain('123456789')
  })
})
