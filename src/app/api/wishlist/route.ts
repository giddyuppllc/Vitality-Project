import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Server-persisted wishlist for logged-in users.
//
// GET    -> { items: [{ productId, product: { id, name, slug, price, images } }] }
// POST   { productId } -> idempotent add
// DELETE ?productId=X -> remove
// PUT    { productIds: string[] } -> merge a client-side list into the
//                                     user's server-side wishlist (used at
//                                     login to upgrade localStorage items
//                                     into a persistent record).
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ items: [] })

  const items = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          comparePrice: true,
          status: true,
          images: { take: 1, select: { url: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ items })
}

const postSchema = z.object({ productId: z.string() })
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  }
  try {
    const { productId } = postSchema.parse(await req.json())
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: session.user.id, productId } },
      update: {},
      create: { userId: session.user.id, productId },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('[wishlist POST]', err)
    return NextResponse.json({ error: 'Add failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  }
  const productId = new URL(req.url).searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })
  await prisma.wishlistItem
    .delete({ where: { userId_productId: { userId: session.user.id, productId } } })
    .catch(() => null) // idempotent — gone is gone
  return NextResponse.json({ ok: true })
}

const putSchema = z.object({ productIds: z.array(z.string()).max(200) })
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  }
  try {
    const { productIds } = putSchema.parse(await req.json())
    if (productIds.length === 0) return NextResponse.json({ ok: true, merged: 0 })
    // Filter to real products only
    const valid = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    })
    const validIds = new Set(valid.map((p) => p.id))
    const toCreate = productIds.filter((id) => validIds.has(id))
    if (toCreate.length === 0) return NextResponse.json({ ok: true, merged: 0 })

    await prisma.wishlistItem.createMany({
      data: toCreate.map((productId) => ({ userId: session.user.id, productId })),
      skipDuplicates: true,
    })
    return NextResponse.json({ ok: true, merged: toCreate.length })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('[wishlist PUT]', err)
    return NextResponse.json({ error: 'Merge failed' }, { status: 500 })
  }
}
