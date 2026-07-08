import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().optional().nullable(),
  price: z.number().int().min(0),
  inventory: z.number().int().min(0).default(0),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await guard()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const variants = await prisma.productVariant.findMany({
    where: { productId: id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(variants)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await guard()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const data = schema.parse(await req.json())
    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        name: data.name,
        sku: data.sku || undefined,
        price: data.price,
        inventory: data.inventory,
      },
    })
    return NextResponse.json(variant, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Variant create error:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
