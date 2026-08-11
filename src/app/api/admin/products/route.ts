import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { slugify } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import { findSimilarProduct } from '@/lib/similar-product'

const productSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string(),
  shortDesc: z.string().optional(),
  price: z.number().int().min(0),
  comparePrice: z.number().int().optional(),
  sku: z.string().optional(),
  categoryId: z.string().optional(),
  inventory: z.number().int().min(0).default(0),
  featured: z.boolean().default(false),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
  tags: z.array(z.string()).default([]),
  images: z.array(z.object({ url: z.string(), alt: z.string().optional(), position: z.number() })).default([]),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const raw = await req.json()
    const force = raw?.force === true
    const { images, ...data } = productSchema.parse(raw)

    // Refuse to create a near-duplicate, and say WHICH product it looks like.
    //
    // The catalog grew five duplicate rows because two seeds upserted on slug,
    // and a slug cannot tell that "CJC-1295 w/DAC" and "CJC-1295 w/ DAC" are
    // the same product. The seed is fixed; this closes the same hole in the
    // admin path, where a typo used to silently produce a second product with
    // its own stock and its own URL.
    //
    // `force: true` in the body overrides it, for the genuine case of two
    // similarly-named products.
    const similar = await findSimilarProduct(data.name, data.sku ?? null)
    if (similar && !force) {
      return NextResponse.json(
        {
          error: 'duplicate',
          message:
            similar.reason === 'same-sku'
              ? `SKU ${data.sku} already belongs to "${similar.name}".`
              : `This looks like "${similar.name}", which already exists. Edit that instead, or resend with force to create a separate product.`,
          match: similar,
        },
        { status: 409 },
      )
    }

    const product = await prisma.product.create({
      data: { ...data, slug: slugify(data.name), images: { create: images } },
      include: { images: true, category: true },
    })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'product.create',
      entityType: 'Product',
      entityId: product.id,
      metadata: { name: product.name, price: product.price },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 })
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
