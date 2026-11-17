import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * The signed-in customer's own orders, newest first — just enough to label a
 * support ticket. The "Related order" picker on /account/support/new fetched
 * /api/orders, which has never existed (404), so the picker never appeared.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    select: { id: true, orderNumber: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(orders)
}
