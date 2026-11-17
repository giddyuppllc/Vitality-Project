import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { purgeProductCache } from '@/lib/cloudflare-purge'
import { zodMessage } from '@/lib/zod-message'
import { syncProductInventory, hasVariants } from '@/lib/product-stock'

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().optional().nullable(),
  price: z.number().int().min(0).optional(),
  inventory: z.number().int().min(0).optional(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; variantId: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, variantId } = await params
  try {
    const data = patchSchema.parse(await req.json())
    // The variant must belong to the product in the URL (the stock re-sync
    // below runs on that product).
    const before = await prisma.productVariant.findFirst({ where: { id: variantId, productId: id } })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...data,
        sku: data.sku === null ? null : data.sku,
      },
    })
    await syncProductInventory(id)
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'product.variant.update',
      entityType: 'Product',
      entityId: id,
      metadata: {
        variantId,
        changes: Object.fromEntries(
          Object.keys(data).map((k) => [k, { from: before[k as keyof typeof before], to: variant[k as keyof typeof variant] }]),
        ),
      },
    })
    void purgeSlug(id)
    return NextResponse.json(variant)
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: zodMessage(error) }, { status: 400 })
    console.error('Variant update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; variantId: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, variantId } = await params
  try {
    const before = await prisma.productVariant.findFirst({ where: { id: variantId, productId: id } })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.productVariant.delete({ where: { id: variantId } })
    await syncProductInventory(id)
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'product.variant.delete',
      entityType: 'Product',
      entityId: id,
      metadata: { variantId, name: before.name, price: before.price, inventory: before.inventory },
    })
    void purgeSlug(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Variant delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

async function purgeSlug(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } })
  if (p) await purgeProductCache({ slug: p.slug }).catch((err) => console.error('[variants] purge failed:', err))
}
