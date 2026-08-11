import { prisma } from '@/lib/prisma'

/**
 * When a product has variants, the VARIANTS hold the stock and
 * `product.inventory` is derived from them.
 *
 * WHY
 * Both fields were independently editable, so they drifted. On 2026-08-10, 22
 * of 24 active products disagreed and five variants had gone negative:
 * Retatrutide read 150 at product level against 1,981 across its variants;
 * NAD+ read 180 with variants at 0.
 *
 * Checkout decrements the VARIANT whenever an order line has one — and 52 of
 * 58 order lines did. So the product-level number simply never moved for those
 * products: it was a second, stale ledger that looked authoritative in the
 * admin UI.
 *
 * Reconciling the rows once (done) fixes today. Making the number DERIVED is
 * what stops it happening again — otherwise the next person to type into the
 * product Stock box re-creates the split.
 *
 * Products with NO variants keep `product.inventory` as their real ledger —
 * Bacteriostatic Water and the Reconstitution Kit are sold that way, and there
 * is nowhere else to put the number.
 */

/** True when this product's stock lives on its variants. */
export async function hasVariants(productId: string): Promise<boolean> {
  return (await prisma.productVariant.count({ where: { productId } })) > 0
}

/**
 * Recompute `product.inventory` from its variants. Call after ANY variant
 * create / update / delete, so the derived value never lags the truth.
 *
 * No-ops for products without variants — their own count is the ledger.
 */
export async function syncProductInventory(productId: string): Promise<number | null> {
  const rows = await prisma.productVariant.findMany({
    where: { productId },
    select: { inventory: true },
  })
  if (rows.length === 0) return null

  // GREATEST(x,0) in spirit: a negative variant should never drag the product
  // total below zero, even though decrementStock now prevents new negatives.
  const total = rows.reduce((sum, r) => sum + Math.max(0, r.inventory), 0)
  await prisma.product.update({ where: { id: productId }, data: { inventory: total } })
  return total
}
