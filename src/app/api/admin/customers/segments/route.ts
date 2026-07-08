import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DAY = 24 * 60 * 60 * 1000

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY)

  const [total, newCount, affiliateCount, atRiskCount, vipCount] = await Promise.all([
    prisma.user.count({ where: { role: { in: ['CUSTOMER', 'AFFILIATE'] } } }),
    prisma.user.count({
      where: { role: { in: ['CUSTOMER', 'AFFILIATE'] }, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.user.count({ where: { role: 'AFFILIATE' } }),
    // At-risk: has at least one paid order, but none in the last 90 days
    prisma.user.count({
      where: {
        role: { in: ['CUSTOMER', 'AFFILIATE'] },
        orders: {
          some: { paymentStatus: 'PAID' },
          none: { paymentStatus: 'PAID', createdAt: { gte: ninetyDaysAgo } },
        },
      },
    }),
    // VIP: $2k+ lifetime spend — via raw SQL aggregate
    (async () => {
      const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM (
           SELECT u.id, COALESCE(SUM(o.total), 0) AS ltv
           FROM users u
           LEFT JOIN orders o ON o."userId" = u.id AND o."paymentStatus" = 'PAID'
           WHERE u.role IN ('CUSTOMER', 'AFFILIATE')
           GROUP BY u.id
           HAVING COALESCE(SUM(o.total), 0) >= 200000
         ) t`
      )
      return Number(rows[0]?.count ?? 0)
    })(),
  ])

  return NextResponse.json({
    all: total,
    new: newCount,
    vip: vipCount,
    atRisk: atRiskCount,
    affiliates: affiliateCount,
  })
}
