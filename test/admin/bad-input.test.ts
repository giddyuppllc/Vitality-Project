import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import NotificationsPage from '@/app/admin/notifications/page'
import AuditPage from '@/app/admin/audit/page'
import { GET as tasksGET, POST as tasksPOST } from '@/app/api/admin/tasks/route'
import { POST as leadsPOST } from '@/app/api/admin/leads/route'
import { PATCH as leadPATCH } from '@/app/api/admin/leads/[id]/route'
import { fakeEmail, makeUser, params, req, setSession } from '../helpers'

/** Junk query/body values must be ignored or a 400 — never a 500 / crashed page. */
describe('admin pages/APIs tolerate bad input', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'bad-admin', role: 'ADMIN' })
  })
  const asAdmin = () => setSession({ ...admin, role: 'ADMIN' })

  it('notifications ?type=junk renders', async () => {
    asAdmin()
    await expect(NotificationsPage({ searchParams: Promise.resolve({ type: 'junk' }) })).resolves.toBeTruthy()
  })

  it('audit ?from=junk renders', async () => {
    asAdmin()
    await expect(AuditPage({ searchParams: Promise.resolve({ from: 'junk', to: 'also-junk' }) })).resolves.toBeTruthy()
  })

  it('tasks API ignores an unknown status filter; refuses an unparseable due date with 400', async () => {
    asAdmin()
    expect((await tasksGET(req('http://localhost/api/admin/tasks?status=junk&priority=nope'))).status).toBe(200)
    const res = await tasksPOST(req('http://localhost/x', { method: 'POST', body: { title: 'ZZ task', dueAt: 'tomorrow-ish' } }))
    expect(res.status).toBe(400)
  })

  it('leads: bad date is a 400; probability "0" stays 0', async () => {
    asAdmin()
    const bad = await leadsPOST(
      req('http://localhost/x', { method: 'POST', body: { businessName: 'ZZ', contactName: 'ZZ', contactEmail: fakeEmail('lead'), nextActionDue: 'soon' } }),
    )
    expect(bad.status).toBe(400)
    const ok = await leadsPOST(
      req('http://localhost/x', { method: 'POST', body: { businessName: 'ZZ', contactName: 'ZZ', contactEmail: fakeEmail('lead'), probability: '0' } }),
    )
    expect(ok.status).toBeLessThan(300)
    const lead = await ok.json()
    expect((await prisma.salesLead.findUniqueOrThrow({ where: { id: lead.id } })).probability).toBe(0)
    const p = await leadPATCH(req('http://localhost/x', { method: 'PATCH', body: { nextActionDue: 'soon' } }), params({ id: lead.id }))
    expect(p.status).toBe(400)
  })
})
