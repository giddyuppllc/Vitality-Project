import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_PRODUCT_SELECT, parseLimit } from '@/lib/public-product'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const limit = parseLimit(searchParams.get('limit'), 20, 100)

  const where: any = { status: 'ACTIVE' }
  if (category) where.category = { slug: category }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { tags: { has: search } },
    ]
  }

  const products = await prisma.product.findMany({
    where,
    select: PUBLIC_PRODUCT_SELECT,
    take: limit,
    orderBy: { featured: 'desc' },
  })

  return NextResponse.json(products)
}
