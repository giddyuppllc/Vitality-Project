import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  if (!q) return NextResponse.json([])

  const where: any = {
    status: 'ACTIVE',
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { shortDesc: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { tags: { has: q.toLowerCase() } },
      { category: { name: { contains: q, mode: 'insensitive' } } },
    ],
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      images: { orderBy: { position: 'asc' }, take: 1 },
      category: { select: { name: true, slug: true } },
    },
    take: limit,
    orderBy: [{ featured: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json(products)
}
