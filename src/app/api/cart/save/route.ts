import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeCartTotal } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const items = Array.isArray(body?.items) ? body.items : []
    const clientEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null

    if (items.length === 0) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null
    const email = session?.user?.email?.toLowerCase() ?? clientEmail ?? null

    if (!userId && !email) {
      // No way to attribute the cart; silently skip
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Compute subtotal server-side from refs (price field no longer
    // present on the client cart). Abandoned-cart recovery emails need
    // an accurate $X to mention in their copy.
    const refs = items
      .filter((it: { productId?: unknown; quantity?: unknown }) => typeof it?.productId === 'string')
      .map((it: { productId: string; variantId?: string | null; quantity?: number }) => ({
        productId: it.productId,
        variantId: it.variantId ?? null,
        quantity: Math.max(1, Math.min(99, Number(it.quantity) || 1)),
      }))
    const priced = await computeCartTotal(refs, { userId }).catch(() => null)
    const subtotal = priced?.total ?? 0
    const cartJson = JSON.stringify(items)

    await prisma.cartAbandonment.create({
      data: {
        userId,
        email,
        cartJson,
        subtotal,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cart/save]', err)
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 })
  }
}
