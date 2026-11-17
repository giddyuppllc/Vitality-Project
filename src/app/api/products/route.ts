import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_PRODUCT_SELECT, parseLimit } from '@/lib/public-product'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const limit = parseLimit(searchParams.get('limit'), 20, 100)
  // ?ids=a,b,c — current data for specific products (the wishlist page uses
  // it to price saved items and add the right size to the cart).
  const ids = (searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100)

  const where: any = { status: 'ACTIVE' }
  if (category) where.category = { slug: category }
  if (ids.length > 0) where.id = { in: ids }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { tags: { has: search } },
    ]
  }

  const products = await prisma.product.findMany({
    where,
    select: PUBLIC_PRODUCT_SELECT,
    take: ids.length > 0 ? ids.length : limit,
    orderBy: { featured: 'desc' },
  })

  return NextResponse.json(products)
}
