import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/business/clients
 *
 * - OWNER / ADMIN see all OrgClient rows for their org
 * - STAFF / COACH / DOCTOR see only their own attributed clients
 *
 * Optional ?trainerId= filter (owner/admin only) for the gym-owner's view
 * to scope down to one trainer.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { role: 'asc' },
  })
  if (!membership) {
    return NextResponse.json({ error: 'You are not part of an organization' }, { status: 403 })
  }

  const isOwnerOrAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN'

  const { searchParams } = new URL(req.url)
  const trainerFilter = searchParams.get('trainerId')

  const where: any = { organizationId: membership.organizationId }
  if (isOwnerOrAdmin) {
    if (trainerFilter) where.trainerOrgMemberId = trainerFilter
  } else {
    // Non-owners only see their own attributed clients
    where.trainerOrgMemberId = membership.id
  }

  const clients = await prisma.orgClient.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
      trainer: {
        include: { user: { select: { name: true, email: true } } },
      },
      _count: { select: { orders: true } },
    },
    orderBy: { id: 'desc' },
  })

  // Per-client total spend (one aggregate query, scoped to clientIds)
  const clientIds = clients.map((c) => c.id)
  const totals = clientIds.length > 0
    ? await prisma.order.groupBy({
        by: ['clientId'],
        where: { clientId: { in: clientIds }, paymentStatus: 'PAID' },
        _sum: { total: true },
      })
    : []
  const totalsMap = new Map(totals.map((t) => [t.clientId!, t._sum.total ?? 0]))

  return NextResponse.json({
    role: membership.role,
    canSeeAll: isOwnerOrAdmin,
    clients: clients.map((c) => ({
      id: c.id,
      status: c.status,
      user: c.user,
      orderCount: c._count.orders,
      lifetimeSpendCents: totalsMap.get(c.id) ?? 0,
      trainer: c.trainer
        ? {
            id: c.trainer.id,
            name: c.trainer.user.name,
            email: c.trainer.user.email,
            role: c.trainer.role,
          }
        : null,
    })),
  })
}
