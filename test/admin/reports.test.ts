import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { PATCH as affiliatePATCH } from '@/app/api/admin/affiliates/[id]/route'
import AnalyticsPage from '@/app/admin/analytics/page'
import MembersPage from '@/app/admin/members/page'
import { makeUser, params, req, setSession } from '../helpers'

function text(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  const el = node as { props?: { children?: unknown } }
  return el.props ? text(el.props.children) : ''
}
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

describe('admin reports + affiliate edit', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'rep-admin', role: 'ADMIN' })
  })

  it('affiliate edit with a bad commission rate is a readable 400, not a 500', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const u = await makeUser({ tag: 'rep-aff' })
    const aff = await prisma.affiliate.create({ data: { userId: u.id, code: `ZZR${uniq().toUpperCase()}` } })
    const res = await affiliatePATCH(req('http://localhost/x', { method: 'PATCH', body: { commissionRate: 12 } }), params({ id: aff.id }))
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('analytics Top products ignores unpaid orders', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const name = `ZZ-TEST unpaid bestseller ${uniq()}`
    const p = await prisma.product.create({ data: { name, slug: `zz-${uniq()}`, description: 'x', price: 1 } })
    await prisma.order.create({
      data: {
        orderNumber: `ZZ-AN-${uniq()}`, email: 'zz@example.invalid', subtotal: 99_999_900, total: 99_999_900, paymentStatus: 'UNPAID',
        items: { create: [{ productId: p.id, name, price: 99_999_900, quantity: 1, total: 99_999_900 }] },
      },
    })
    expect(text(await AnalyticsPage())).not.toContain(name)
  })

  it('members tab counts match the list scope (tier != NONE) and include PAST_DUE under awaiting payment', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const pastDue = await makeUser({ tag: 'rep-pastdue' })
    await prisma.membership.create({ data: { userId: pastDue.id, tier: 'PLUS', status: 'PAST_DUE' } })
    const none = await makeUser({ tag: 'rep-none' })
    await prisma.membership.create({ data: { userId: none.id, tier: 'NONE', status: 'PENDING_PAYMENT' } })
    const pending = await prisma.membership.count({ where: { tier: { not: 'NONE' }, status: { in: ['PENDING_PAYMENT', 'PAST_DUE'] } } })
    const page = text(await MembersPage({ searchParams: Promise.resolve({ status: 'pending' }) }))
    expect(page).toContain(pastDue.email)
    expect(page).toContain(`Awaiting payment ${pending}`)
  })
})
