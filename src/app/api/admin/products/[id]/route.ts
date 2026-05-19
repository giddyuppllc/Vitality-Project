import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { setProductStatus } from '@/lib/products'
import { purgeProductCache } from '@/lib/cloudflare-purge'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  shortDesc: z.string().optional(),
  price: z.number().int().min(0).optional(),
  comparePrice: z.number().int().nullable().optional(),
  salePrice: z.number().int().nullable().optional(),
  sku: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  inventory: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  tags: z.array(z.string()).optional(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await guard()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { position: 'asc' } }, category: true },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const data = updateSchema.parse(await req.json())

    // Status changes go through the central helper so they get an
    // AuditLog row with before/after + an AdminNotification when an
    // ACTIVE product is being hidden from the storefront.
    if (data.status !== undefined) {
      await setProductStatus(id, data.status, {
        userId: session.user.id,
        userEmail: session.user.email,
        source: 'admin/products PATCH',
      })
    }

    // All other fields update normally; we omit `status` from the
    // update payload because the helper handled it (writing it twice
    // would be a no-op but the second write would not be audit-logged).
    const { status: _status, ...rest } = data
    const product = await prisma.product.update({
      where: { id },
      data: rest,
      include: { images: true, category: true },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'product.update',
      entityType: 'Product',
      entityId: id,
      metadata: { changes: Object.keys(data) },
    })

    // Purge Cloudflare edge cache so the new product data is visible to
    // every visitor immediately, not whenever the edge TTL expires.
    // Fire-and-forget; admin save is not blocked on the purge call.
    void purgeProductCache({ slug: product.slug }).catch((err) =>
      console.error('[admin/products PATCH] cloudflare purge failed:', err),
    )

    return NextResponse.json(product)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  // Soft-delete = archive. The helper writes the AuditLog row + the
  // AdminNotification (if the product was ACTIVE and isn't an internal
  // placeholder) so a stray DELETE click is visible in the inbox.
  await setProductStatus(id, 'ARCHIVED', {
    userId: session.user.id,
    userEmail: session.user.email,
    source: 'admin/products DELETE (soft-delete)',
  })
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: 'product.delete',
    entityType: 'Product',
    entityId: id,
  })
  return NextResponse.json({ ok: true })
}
