import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Returns the CURRENT server-side price for each cart line so the client
// can detect when the localStorage-stored cart price has drifted from the
// real DB price (admin edited the product in the meantime). The customer
// then sees a "Price updated" banner and gets the option to refresh.
//
// Server-side checkout already recomputes prices from the DB on order
// creation, so the actual charge is always correct. This endpoint exists
// only to keep the customer's *displayed* cart total honest.
const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional().nullable(),
      }),
    )
    .max(50),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items } = schema.parse(body)
    if (items.length === 0) return NextResponse.json({ items: [] })

    const productIds = Array.from(new Set(items.map((i) => i.productId)))
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        price: true,
        status: true,
        variants: { select: { id: true, price: true } },
      },
    })
    const byId = Object.fromEntries(products.map((p) => [p.id, p]))

    const result = items.map((item) => {
      const p = byId[item.productId]
      if (!p) {
        return {
          productId: item.productId,
          variantId: item.variantId ?? null,
          currentPrice: null,
          available: false,
          reason: 'not-found',
        }
      }
      if (p.status !== 'ACTIVE') {
        return {
          productId: item.productId,
          variantId: item.variantId ?? null,
          currentPrice: null,
          available: false,
          reason: 'archived',
        }
      }
      const variant = item.variantId
        ? p.variants.find((v) => v.id === item.variantId)
        : null
      const currentPrice = variant?.price ?? p.price
      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        currentPrice,
        available: true,
      }
    })

    return NextResponse.json({ items: result })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('[cart/refresh-prices]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
