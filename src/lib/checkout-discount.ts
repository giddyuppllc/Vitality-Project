import { prisma } from '@/lib/prisma'
import { validateCoupon } from '@/lib/coupon-validator'

/**
 * Discount codes at checkout (card + Zelle).
 *
 * WHY
 * Both checkouts looked the code up and applied `value` directly: every rule
 * an admin can set in /admin/discounts (minimum order, products, categories,
 * customers, new-customer / first-purchase only, members only, loyalty tier,
 * uses per customer) was ignored, and a FREE_SHIPPING or BOGO code took its
 * `value` off as cash instead. The order also stored the code exactly as
 * typed, so "save10" never matched "SAVE10" when counting uses per customer.
 *
 * WHAT THIS DOES
 * Runs the code through validateCoupon (all the rules) and prices it against
 * `base`, the amount after member/bundle discounts — the same base the
 * checkouts already used, so a valid PERCENTAGE / FIXED code is charged
 * exactly as before.
 *
 * An UNKNOWN code returns null rather than an error: customers type
 * affiliate codes into the same box, and those are attributed separately.
 * A code that exists but does not apply throws DiscountCodeError with the
 * reason, so the customer is told instead of silently paying full price.
 *
 * NOT ENFORCED (no behaviour defined anywhere yet — flagged for the owner):
 * `stackable` (codes always stack on the member/bundle discount, as before)
 * and `autoApply`.
 */

export class DiscountCodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiscountCodeError'
  }
}

export interface PricedDiscountCode {
  id: string
  /** Canonical (upper-case) code — store this on the order. */
  code: string
  maxUses: number | null
  /** Cents off the merchandise. */
  amount: number
  /** FREE_SHIPPING codes waive shipping instead of taking cash off. */
  freeShipping: boolean
}

export function normalizeDiscountCode(raw: string | null | undefined): string | null {
  const c = raw?.trim().toUpperCase()
  return c ? c : null
}

export async function priceDiscountCode(
  raw: string | null | undefined,
  ctx: {
    userId: string | null
    /** Gross merchandise subtotal — what minimum-order rules compare against. */
    subtotal: number
    /** Amount the code is taken off: subtotal after member/bundle discounts. */
    base: number
    items: Array<{ productId: string; quantity: number }>
  },
): Promise<PricedDiscountCode | null> {
  const normalized = normalizeDiscountCode(raw)
  if (!normalized) return null

  const code = await prisma.discountCode.findUnique({ where: { code: normalized } })
  if (!code) return null

  const productIds = Array.from(new Set(ctx.items.map((i) => i.productId)))
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { categoryId: true },
  })
  const categoryIds = Array.from(
    new Set(products.map((p) => p.categoryId).filter((c): c is string => !!c)),
  )

  const check = await validateCoupon(normalized, {
    userId: ctx.userId ?? undefined,
    subtotal: ctx.subtotal,
    productIds,
    categoryIds,
  })
  if (!check.valid) throw new DiscountCodeError(check.error ?? 'This code cannot be used on this order')

  const base = Math.max(0, ctx.base)
  let amount = 0
  let freeShipping = false
  switch (code.type) {
    case 'PERCENTAGE':
      amount = Math.round(base * (Math.min(100, Math.max(0, code.value)) / 100))
      break
    case 'FIXED':
      amount = Math.min(Math.max(0, code.value), base)
      break
    case 'FREE_SHIPPING':
      freeShipping = true
      break
    case 'BOGO': {
      // Defined by validateCoupon: 50% off when buying 2+ items.
      const units = ctx.items.reduce((n, i) => n + i.quantity, 0)
      if (units < 2) throw new DiscountCodeError('This code needs at least 2 items in the order')
      amount = Math.round(base / 2)
      break
    }
  }

  return { id: code.id, code: code.code, maxUses: code.maxUses, amount: Math.min(amount, base), freeShipping }
}

/**
 * Atomically claim one use (conditional on usedCount < maxUses), so
 * concurrent checkouts can't redeem past the cap. Returns false if the cap
 * was reached in the meantime.
 */
export async function claimDiscountCodeUse(code: { id: string; maxUses: number | null }): Promise<boolean> {
  if (code.maxUses == null) {
    await prisma.discountCode.update({ where: { id: code.id }, data: { usedCount: { increment: 1 } } })
    return true
  }
  const { count } = await prisma.discountCode.updateMany({
    where: { id: code.id, usedCount: { lt: code.maxUses } },
    data: { usedCount: { increment: 1 } },
  })
  return count > 0
}
