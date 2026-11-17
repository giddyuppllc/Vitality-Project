/**
 * The price a SHOPPER sees for a product — must equal what checkout charges.
 *
 * WHY
 * When a product has variants, checkout prices each line from the VARIANT
 * (`src/lib/pricing.ts`: `variant?.price ?? p.price`). `Product.price` is a
 * second, hand-edited number that drifted: on 2026-11-17, 13 of 23 live
 * product pages headlined a price that was not the price in the cart —
 * Selank showed $45 and charged $74, Semax $41 → $76, BPC-157 $80 → $64 —
 * and the Product JSON-LD fed the wrong figure to Google. The product cards
 * already used the cheapest variant; the detail page, search dropdown,
 * related products, wishlist, kiosk and the chat assistant did not.
 *
 * RULE (mirrors the product card and the pricing engine)
 *   - No variants → `product.price`.
 *   - Variants → only variants with a price above zero are sellable (the
 *     pricing engine refuses a $0 line as 'price-unset'). The display price
 *     is the cheapest sellable variant.
 *   - Variants exist but none is sellable → `null`: the product cannot be
 *     bought, and the UI must say so instead of showing a price.
 */

export interface PricedVariant {
  price: number
}

export interface PricedProduct {
  price: number
  variants?: PricedVariant[] | null
}

/** Variants a shopper can actually buy, cheapest first. */
export function sellableVariants<V extends PricedVariant>(variants: V[] | null | undefined): V[] {
  return (variants ?? []).filter((v) => v.price > 0).sort((a, b) => a.price - b.price)
}

/** Lowest price a shopper can pay, in cents, or null when nothing is sellable. */
export function displayPrice(product: PricedProduct): number | null {
  const variants = product.variants ?? []
  if (variants.length === 0) return product.price > 0 ? product.price : null
  const sellable = sellableVariants(variants)
  return sellable.length > 0 ? sellable[0].price : null
}

/** Highest sellable price (for AggregateOffer / "from–to" ranges). */
export function highestPrice(product: PricedProduct): number | null {
  const variants = product.variants ?? []
  if (variants.length === 0) return product.price > 0 ? product.price : null
  const sellable = sellableVariants(variants)
  return sellable.length > 0 ? sellable[sellable.length - 1].price : null
}

/** True when more than one sellable price exists, so the UI should say "from". */
export function hasPriceRange(product: PricedProduct): boolean {
  const lo = displayPrice(product)
  const hi = highestPrice(product)
  return lo !== null && hi !== null && hi > lo
}

/** Whole-percent saving vs. the compare-at price, or null when there is none. */
export function discountPercent(comparePrice: number | null | undefined, price: number | null): number | null {
  if (!comparePrice || price === null || comparePrice <= price) return null
  return Math.round(((comparePrice - price) / comparePrice) * 100)
}
