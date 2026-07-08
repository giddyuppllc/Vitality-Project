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

  const products = await prisma.product.findMany({
    include: {
      category: { select: { name: true } },
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku ?? '',
    category: p.category?.name ?? '',
    status: p.status,
    featured: p.featured ? 'yes' : 'no',
    price_cents: p.price,
    compare_price_cents: p.comparePrice ?? '',
    sale_price_cents: p.salePrice ?? '',
    inventory: p.inventory,
    tags: p.tags.join('|'),
    sold: p._count.orderItems,
    created_at: p.createdAt.toISOString(),
  }))

  const csv = toCsv(rows)
  return csvResponse(csv, `products-${new Date().toISOString().slice(0, 10)}.csv`)
}
