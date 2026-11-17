import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import CustomersPage from '@/app/admin/customers/page'
import { fakeEmail, makeUser, setSession } from '../helpers'

function text(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  const el = node as { props?: { children?: unknown } }
  return el.props ? text(el.props.children) : ''
}

describe('admin customers list', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'cust-admin', role: 'ADMIN' })
  })

  it('the VIP tab includes big spenders older than the newest 500 customers', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const vip = await prisma.user.create({
      data: { email: fakeEmail('old-vip'), name: 'ZZ Old VIP', role: 'CUSTOMER', createdAt: new Date('2019-01-01T00:00:00Z') },
    })
    await prisma.order.create({
      data: { orderNumber: `ZZ-VIP-${Date.now().toString(36)}`, userId: vip.id, email: vip.email, subtotal: 250000, total: 250000, paymentStatus: 'PAID' },
    })
    await prisma.user.createMany({
      data: Array.from({ length: 510 }, (_, i) => ({ email: fakeEmail(`filler${i}`), role: 'CUSTOMER' as const })),
    })
    const page = text(await CustomersPage({ searchParams: Promise.resolve({ segment: 'vip' }) }))
    expect(page).toContain(vip.email)
  })
})
