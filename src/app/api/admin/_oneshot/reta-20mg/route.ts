import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// One-shot migration: adds the Retatrutide 20mg variant + flips inventory
// flags so the new "In stock" / "Pre-order" badges render correctly.
//
// Admin-auth gated, idempotent (re-runs are no-ops). Remove this file after
// the run. Created 2026-05-18 to apply a DB change while SSH access to the
// host was rate-limited.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const reta = await prisma.product.findUnique({
    where: { slug: 'retatrutide' },
    include: { variants: { orderBy: { price: 'asc' } } },
  })
  if (!reta) {
    return NextResponse.json({ error: 'Retatrutide product not found' }, { status: 404 })
  }

  // 1. Flip inventory flags on existing variants. Only 10mg is in stock; 5/30/50/60 are pre-order.
  for (const v of reta.variants) {
    const inStock = v.name === '10 mg'
    if (v.inventory !== (inStock ? 999 : 0)) {
      await prisma.productVariant.update({
        where: { id: v.id },
        data: { inventory: inStock ? 999 : 0 },
      })
    }
  }

  // 2. Add or update the 20mg variant — $95 to customer, 999 in stock.
  const existing20 = reta.variants.find((v) => v.name === '20 mg')
  let variantId: string
  if (existing20) {
    const u = await prisma.productVariant.update({
      where: { id: existing20.id },
      data: { price: 9500, inventory: 999 },
      select: { id: true },
    })
    variantId = u.id
  } else {
    const c = await prisma.productVariant.create({
      data: {
        productId: reta.id,
        name: '20 mg',
        sku: 'VP-RETA-20MG',
        price: 9500,
        inventory: 999,
      },
      select: { id: true },
    })
    variantId = c.id
  }

  // Return the final state so admin can sanity-check.
  const after = await prisma.productVariant.findMany({
    where: { productId: reta.id },
    orderBy: { price: 'asc' },
    select: { name: true, sku: true, price: true, inventory: true },
  })
  return NextResponse.json({
    ok: true,
    new20mgVariantId: variantId,
    variants: after,
  })
}
