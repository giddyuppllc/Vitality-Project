import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { computeCartTotal } from '@/lib/pricing'
import { z } from 'zod'

// POST /api/cart
//
// Client supplies the cart REFS (productId, variantId, quantity) only —
// never prices. Server looks up every line's current price, runs it
// through the bundle + member discount pipeline (see src/lib/pricing.ts),
// and returns the fully priced cart for display.
//
// This is the SINGLE source of truth for cart math. The cart page, the
// checkout page, and the checkout submit endpoint all derive their
// numbers from `computeCartTotal()`. There is no other code path.
//
// POST is used (not GET) because the cart contents are sent in the body
// — GET-with-body is non-standard. Auth-optional: anonymous carts work,
// just without member discounts.

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().nullable().optional(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .max(50),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items } = schema.parse(body)
    const session = await getServerSession(authOptions)
    const cart = await computeCartTotal(items, { userId: session?.user?.id ?? null })
    return NextResponse.json(cart)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('[api/cart] error:', err)
    return NextResponse.json({ error: 'Failed to compute cart' }, { status: 500 })
  }
}
