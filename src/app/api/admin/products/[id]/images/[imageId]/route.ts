import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { resyncProductImages } from '@/lib/product-images'
import { z } from 'zod'

const patchSchema = z.object({
  // Move this image to the front so it becomes the product-card image.
  makePrimary: z.boolean().optional(),
  alt: z.string().max(300).nullable().optional(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, imageId } = await params
  try {
    const data = patchSchema.parse(await req.json())

    if (data.makePrimary) {
      // Park it ahead of everything; resync repacks to a clean 0..n-1 and
      // mirrors the new position-0 URL into Product.image.
      await prisma.productImage.update({
        where: { id: imageId },
        data: { position: -1 },
      })
    }
    if (data.alt !== undefined) {
      await prisma.productImage.update({
        where: { id: imageId },
        data: { alt: data.alt },
      })
    }

    await resyncProductImages(id)

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'product.image.update',
      entityType: 'Product',
      entityId: id,
      metadata: { imageId, makePrimary: data.makePrimary ?? false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Product image update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, imageId } = await params
  try {
    await prisma.productImage.delete({ where: { id: imageId } })
    await resyncProductImages(id)

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'product.image.delete',
      entityType: 'Product',
      entityId: id,
      metadata: { imageId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Product image delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
