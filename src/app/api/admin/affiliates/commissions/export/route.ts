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

  const commissions = await prisma.affiliateCommission.findMany({
    include: {
      affiliate: {
        include: { user: { select: { email: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = commissions.map((c) => ({
    id: c.id,
    affiliate_code: c.affiliate.code,
    affiliate_name: c.affiliate.user.name ?? '',
    affiliate_email: c.affiliate.user.email,
    order_id: c.orderId,
    amount_cents: c.amount,
    status: c.status,
    created_at: c.createdAt.toISOString(),
  }))

  const csv = toCsv(rows)
  return csvResponse(
    csv,
    `commissions-${new Date().toISOString().slice(0, 10)}.csv`,
  )
}
