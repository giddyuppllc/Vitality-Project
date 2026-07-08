import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { resyncProductImages } from '@/lib/product-images'
import { z } from 'zod'

// URL is the relative /uploads/... path returned by POST /api/admin/upload.
const createSchema = z.object({
  url: z.string().min(1).max(1000),
  alt: z.string().max(300).nullable().optional(),
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
  const images = await prisma.productImage.findMany({
    where: { productId: id },
    orderBy: { position: 'asc' },
  })
  return NextResponse.json(images)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const data = createSchema.parse(await req.json())

    // Append to the end; resync repacks positions and re-points Product.image
    // at whatever is first (so the very first upload becomes the card image).
    const count = await prisma.productImage.count({ where: { productId: id } })
    const image = await prisma.productImage.create({
      data: { productId: id, url: data.url, alt: data.alt || null, position: count },
    })
    await resyncProductImages(id)

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'product.image.add',
      entityType: 'Product',
      entityId: id,
      metadata: { url: data.url },
    })

    return NextResponse.json(image, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Product image create error:', error)
    return NextResponse.json({ error: 'Failed to add image' }, { status: 500 })
  }
}
