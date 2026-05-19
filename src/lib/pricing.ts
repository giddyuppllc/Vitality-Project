/**
 * The Vitality Project — single source of truth for cart pricing.
 *
 * This module is the ONLY place in the codebase that computes a priced
 * cart total. The cart page, the checkout page, the checkout submit
 * endpoint, the discount preview — all call `computeCartTotal()`. There
 * is no other path. If the math is wrong here, it's wrong everywhere
 * consistently; we never have a "cart says X / checkout charges Y" mismatch.
 *
 * Input: cart line refs only — `{ productId, variantId?, quantity }`.
 * The caller does NOT supply prices. We look up every line's price from
 * the live database, run it through the bundle-discount pipeline, apply
 * member discounts, and return the priced cart.
 */

import { prisma } from '@/lib/prisma'
import { calculateBundleDiscount } from '@/lib/bundle-discount'
import { getUserMembership, calculateMemberDiscount } from '@/lib/membership'
import type { MembershipTier } from '@prisma/client'

export interface CartRef {
  productId: string
  variantId?: string | null
  quantity: number
}

export interface PricedLine {
  productId: string
  variantId: string | null
  /** Name as it should appear in cart UI, including variant suffix
   *  (e.g., "Retatrutide — 20 mg"). Falls back to product name if no variant. */
  name: string
  slug: string
  /** Single product image URL for cart thumbnails, or null. */
  image: string | null
  /** Unit price in cents, sourced from the variant if specified, else the product's base price. */
  unitPrice: number
  quantity: number
  /** unitPrice * quantity */
  lineTotal: number
  /** ACTIVE / DRAFT / ARCHIVED status of the underlying product. */
  productStatus: string
  /** true if the line can actually be ordered (ACTIVE + (no variant OR variant exists)). */
  available: boolean
  /** Why available is false, if applicable. */
  reason?: 'archived' | 'product-not-found' | 'variant-not-found'
}

export interface PricedCart {
  lines: PricedLine[]
  /** Sum of every available line's lineTotal. */
  subtotal: number
  /** Bundle discount details from calculateBundleDiscount(). */
  bundle: {
    qualifyingCount: number
    discountPct: number
    discountCents: number
    tierLabel: string | null
    nextTier: { remaining: number; pct: number } | null
  }
  /** Permanent membership discount applied to the full subtotal. */
  member: {
    tier: MembershipTier
    discountCents: number
  }
  totalDiscount: number
  /** Final cart total after both discounts (shipping/tax are applied later
   *  at checkout because they need address + zip). */
  total: number
  /** Number of lines flagged unavailable (archived, missing). UI should
   *  prompt the customer to remove them. */
  unavailableCount: number
}

/**
 * Compute the priced cart given a list of refs and an optional userId for
 * membership lookup. Anonymous (no userId) carts get bundle discounts but
 * no member discount.
 */
export async function computeCartTotal(
  refs: CartRef[],
  opts: { userId?: string | null } = {},
): Promise<PricedCart> {
  if (refs.length === 0) {
    return emptyCart()
  }

  // 1. Pull every referenced product + its variants + first image, in one query.
  const productIds = Array.from(new Set(refs.map((r) => r.productId)))
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      status: true,
      category: { select: { slug: true } },
      images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
      variants: { select: { id: true, name: true, price: true } },
    },
  })
  const productById = new Map(products.map((p) => [p.id, p]))

  // 2. Build priced lines.
  const lines: PricedLine[] = refs.map((ref) => {
    const p = productById.get(ref.productId)
    if (!p) {
      return {
        productId: ref.productId,
        variantId: ref.variantId ?? null,
        name: '(removed)',
        slug: '',
        image: null,
        unitPrice: 0,
        quantity: ref.quantity,
        lineTotal: 0,
        productStatus: 'UNKNOWN',
        available: false,
        reason: 'product-not-found',
      }
    }
    let variant: { id: string; name: string; price: number } | null = null
    if (ref.variantId) {
      variant = p.variants.find((v) => v.id === ref.variantId) ?? null
    }
    if (ref.variantId && !variant) {
      return {
        productId: p.id,
        variantId: ref.variantId,
        name: p.name,
        slug: p.slug,
        image: p.images[0]?.url ?? null,
        unitPrice: 0,
        quantity: ref.quantity,
        lineTotal: 0,
        productStatus: p.status,
        available: false,
        reason: 'variant-not-found',
      }
    }
    if (p.status !== 'ACTIVE') {
      const unitPrice = variant?.price ?? p.price
      return {
        productId: p.id,
        variantId: variant?.id ?? null,
        name: variant ? `${p.name} — ${variant.name}` : p.name,
        slug: p.slug,
        image: p.images[0]?.url ?? null,
        unitPrice,
        quantity: ref.quantity,
        lineTotal: unitPrice * ref.quantity,
        productStatus: p.status,
        available: false,
        reason: 'archived',
      }
    }
    const unitPrice = variant?.price ?? p.price
    return {
      productId: p.id,
      variantId: variant?.id ?? null,
      name: variant ? `${p.name} — ${variant.name}` : p.name,
      slug: p.slug,
      image: p.images[0]?.url ?? null,
      unitPrice,
      quantity: ref.quantity,
      lineTotal: unitPrice * ref.quantity,
      productStatus: p.status,
      available: true,
    }
  })

  // 3. Discounts — only consider available lines.
  const availableLines = lines.filter((l) => l.available)
  const subtotal = availableLines.reduce((s, l) => s + l.lineTotal, 0)

  // Membership tier — drives the subscriber-only bundle tier table + member discount.
  const membership = opts.userId
    ? await getUserMembership(opts.userId)
    : { tier: 'NONE' as MembershipTier }
  const isSubscriber = membership.tier !== 'NONE'

  // Bundle discount uses the category slug; we already loaded that above.
  const bundleItems = availableLines.map((l) => ({
    productId: l.productId,
    categorySlug: productById.get(l.productId)?.category?.slug ?? null,
    price: l.unitPrice,
    quantity: l.quantity,
  }))
  const bundle = calculateBundleDiscount(bundleItems, { subscriber: isSubscriber })

  const memberDiscountCents = calculateMemberDiscount(subtotal, membership.tier)
  const totalDiscount = bundle.discountCents + memberDiscountCents
  const total = Math.max(0, subtotal - totalDiscount)

  const unavailableCount = lines.filter((l) => !l.available).length

  return {
    lines,
    subtotal,
    bundle: {
      qualifyingCount: bundle.qualifyingCount,
      discountPct: bundle.discountPct,
      discountCents: bundle.discountCents,
      tierLabel: bundle.tierLabel,
      nextTier: bundle.nextTier,
    },
    member: {
      tier: membership.tier,
      discountCents: memberDiscountCents,
    },
    totalDiscount,
    total,
    unavailableCount,
  }
}

function emptyCart(): PricedCart {
  return {
    lines: [],
    subtotal: 0,
    bundle: {
      qualifyingCount: 0,
      discountPct: 0,
      discountCents: 0,
      tierLabel: null,
      nextTier: null,
    },
    member: { tier: 'NONE' as MembershipTier, discountCents: 0 },
    totalDiscount: 0,
    total: 0,
    unavailableCount: 0,
  }
}
