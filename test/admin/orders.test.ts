import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { PATCH } from '@/app/api/admin/orders/[id]/route'
import { POST as markPaid } from '@/app/api/admin/orders/[id]/mark-paid/route'
import AdminOrdersPage from '@/app/admin/orders/page'
import { makeUser, params, req, setSession } from '../helpers'

/** Text of a server component's element tree (host elements only — client components are not invoked). */
function text(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  const el = node as { props?: { children?: unknown } }
  return el.props ? text(el.props.children) : ''
}

const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

async function order(over: Record<string, unknown> = {}) {
  return prisma.order.create({
    data: { orderNumber: `ZZ-ORD-${uniq()}`, email: 'zz-ord@example.invalid', subtotal: 1000, total: 1000, ...over },
  })
}

describe('admin orders', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'orders-admin', role: 'ADMIN' })
  })
  const asAdmin = () => setSession({ ...admin, role: 'ADMIN' })

  it('Internal Notes cannot overwrite a membership invoice marker (mark-paid needs it to activate)', async () => {
    asAdmin()
    const o = await order({ notes: 'MEMBERSHIP:zzmem:PLUS' })
    const res = await PATCH(
      req(`http://localhost/api/admin/orders/${o.id}`, { method: 'PATCH', body: { notes: 'called the customer' } }),
      params({ id: o.id }),
    )
    expect(res.status).toBe(400)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).notes).toBe('MEMBERSHIP:zzmem:PLUS')
  })

  it('ordinary orders still save notes', async () => {
    asAdmin()
    const o = await order()
    const res = await PATCH(
      req(`http://localhost/api/admin/orders/${o.id}`, { method: 'PATCH', body: { notes: 'zz note' } }),
      params({ id: o.id }),
    )
    expect(res.status).toBe(200)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).notes).toBe('zz note')
  })

  it('a bad status is a 400 with a readable message, not a 500', async () => {
    asAdmin()
    const o = await order()
    const res = await PATCH(
      req(`http://localhost/api/admin/orders/${o.id}`, { method: 'PATCH', body: { status: 'LOST' } }),
      params({ id: o.id }),
    )
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('Confirm Payment (mark-paid) is audit-logged', async () => {
    asAdmin()
    const o = await order({ paymentMethod: 'zelle' })
    const res = await markPaid(req(`http://localhost/api/admin/orders/${o.id}/mark-paid`, { method: 'POST' }), params({ id: o.id }))
    expect(res.status).toBe(200)
    const log = await prisma.auditLog.findFirst({ where: { action: 'order.mark_paid', entityId: o.id } })
    expect(log?.userId).toBe(admin.id)
  })

  it('the orders list reaches past the newest 100 and searches by order number', async () => {
    asAdmin()
    const old = await order({ createdAt: new Date('2020-01-01T00:00:00Z') })
    await prisma.order.createMany({
      data: Array.from({ length: 101 }, (_, i) => ({
        orderNumber: `ZZ-BULK-${uniq()}-${i}`,
        email: 'zz-bulk@example.invalid',
        subtotal: 100,
        total: 100,
      })),
    })
    const html = text(await AdminOrdersPage({ searchParams: Promise.resolve({ q: old.orderNumber }) }))
    expect(html).toContain(old.orderNumber)
    const all = text(await AdminOrdersPage({ searchParams: Promise.resolve({}) }))
    expect(all).not.toContain(old.orderNumber) // newest page only
    const total = await prisma.order.count()
    const last = text(
      await AdminOrdersPage({ searchParams: Promise.resolve({ page: String(Math.ceil(total / 50)) }) }),
    )
    expect(last).toContain(old.orderNumber)
  })
})
