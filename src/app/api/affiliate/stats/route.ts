import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
  })

  if (!affiliate) {
    return NextResponse.json({ error: 'No affiliate record found' }, { status: 404 })
  }

  // Total clicks
  const totalClicks = await prisma.affiliateClick.count({
    where: { affiliateId: affiliate.id },
  })

  // Unique clicks (by sessionId)
  const uniqueClicksResult = await prisma.affiliateClick.groupBy({
    by: ['sessionId'],
    where: { affiliateId: affiliate.id },
  })
  const uniqueClicks = uniqueClicksResult.length

  // Commissions aggregated by status
  const commissionsByStatus = await prisma.affiliateCommission.groupBy({
    by: ['status'],
    where: { affiliateId: affiliate.id },
    _count: true,
    _sum: { amount: true },
  })

  const pendingEarnings =
    commissionsByStatus.find((c) => c.status === 'PENDING')?._sum.amount ?? 0
  const approvedEarnings =
    commissionsByStatus.find((c) => c.status === 'APPROVED')?._sum.amount ?? 0
  const paidEarnings =
    commissionsByStatus.find((c) => c.status === 'PAID')?._sum.amount ?? 0
  const totalCommissions = commissionsByStatus.reduce(
    (sum, c) => sum + (c._count ?? 0),
    0
  )

  // Recent clicks
  const recentClicks = await prisma.affiliateClick.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Recent commissions
  const recentCommissions = await prisma.affiliateCommission.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Payouts
  const payouts = await prisma.affiliatePayout.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    affiliate: {
      code: affiliate.code,
      commissionRate: affiliate.commissionRate,
      status: affiliate.status,
      totalEarned: affiliate.totalEarned,
      totalPaid: affiliate.totalPaid,
    },
    stats: {
      totalClicks,
      uniqueClicks,
      totalCommissions,
      pendingEarnings,
      approvedEarnings,
      paidEarnings,
    },
    recentClicks,
    recentCommissions,
    payouts,
  })
}
