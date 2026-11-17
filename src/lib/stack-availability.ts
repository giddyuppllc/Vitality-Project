import { prisma } from '@/lib/prisma'
import { STACKS, type StackDef } from '@/lib/stacks'
import { sellableVariants } from '@/lib/display-price'

/**
 * Which curated stacks can actually be bought right now.
 *
 * WHY
 * `lib/stacks.ts` is a hard-coded list of product slugs; the catalog is in the
 * DB. On 2026-11-17 two live stacks referenced products that are not sold
 * (L-Carnitine, GHK-Cu serum, EGF serum): the Weight Management and Skin
 * Renewal pages each offered ONE product while their cards promised
 * "2 peptides · 5% off" / "3 peptides · 10% off" — a bundle discount the
 * shopper could never get from that page.
 *
 * A component counts when its product is ACTIVE and has something sellable
 * (a size priced above $0, or no sizes and a price above $0). A stack is
 * offered only when at least two components count; the count and tier shown
 * are the available count. When the missing products come back, the stack
 * comes back on its own.
 */
export const MIN_STACK_COMPONENTS = 2

export async function sellableStackSlugs(): Promise<Set<string>> {
  const slugs = [...new Set(STACKS.flatMap((s) => s.components.map((c) => c.productSlug)))]
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs }, status: 'ACTIVE' },
    select: { slug: true, price: true, variants: { select: { price: true } } },
  })
  return new Set(
    products
      .filter((p) => (p.variants.length > 0 ? sellableVariants(p.variants).length > 0 : p.price > 0))
      .map((p) => p.slug),
  )
}

export function availableComponentCount(stack: StackDef, sellable: Set<string>): number {
  return stack.components.filter((c) => sellable.has(c.productSlug)).length
}

/** Stacks that can be bought, each with the number of buyable components. */
export async function availableStacks(): Promise<{ stack: StackDef; count: number }[]> {
  const sellable = await sellableStackSlugs()
  return STACKS.map((stack) => ({ stack, count: availableComponentCount(stack, sellable) })).filter(
    (s) => s.count >= MIN_STACK_COMPONENTS,
  )
}
