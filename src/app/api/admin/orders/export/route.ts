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

  const orders = await prisma.order.findMany({
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = orders.map((o) => ({
    order_number: o.orderNumber,
    status: o.status,
    payment_status: o.paymentStatus,
    email: o.email,
    customer_name: o.user?.name ?? '',
    subtotal_cents: o.subtotal,
    discount_cents: o.discount,
    shipping_cents: o.shipping,
    tax_cents: o.tax,
    total_cents: o.total,
    discount_code: o.discountCode ?? '',
    channel: o.salesChannel,
    items: o._count.items,
    tracking: o.trackingNumber ?? '',
    created_at: o.createdAt.toISOString(),
  }))

  const csv = toCsv(rows)
  return csvResponse(csv, `orders-${new Date().toISOString().slice(0, 10)}.csv`)
}
