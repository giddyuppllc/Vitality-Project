import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toCsv, csvResponse } from '@/lib/csv'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customers = await prisma.user.findMany({
    include: {
      _count: { select: { orders: true } },
      orders: {
        where: { paymentStatus: 'PAID' },
        select: { total: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = customers.map((c) => {
    const ltv = c.orders.reduce((s, o) => s + o.total, 0)
    return {
      id: c.id,
      name: c.name ?? '',
      email: c.email,
      role: c.role,
      orders: c._count.orders,
      lifetime_value_cents: ltv,
      email_verified: c.emailVerified ? 'yes' : 'no',
      two_fa_enabled: c.twoFAEnabled ? 'yes' : 'no',
      created_at: c.createdAt.toISOString(),
    }
  })

  const csv = toCsv(rows)
  return csvResponse(
    csv,
    `customers-${new Date().toISOString().slice(0, 10)}.csv`,
  )
}
