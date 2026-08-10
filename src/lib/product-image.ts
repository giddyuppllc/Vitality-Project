/**
 * The one place that decides what a product looks like when it has no photo.
 *
 * Edward: "the standard or general peptide vial image that's on half the
 * peptides should be on all of them that are missing images."
 *
 * The fallback already existed — it just wasn't applied everywhere. It was
 * inlined in four files, missing from three more (the admin products table,
 * the search-bar results and the pair-with card), and split across THREE
 * different assets:
 *
 *     /products/vial-default-600.png   product card, stacks list
 *     /products/vial-default.png       product detail, stack detail
 *     /products/vial-default.svg       unused
 *
 * So some surfaces showed a vial, some showed a broken/empty box, and the ones
 * that worked didn't agree on which image. A rule that lives in four copies is
 * a rule that will be missed on the fifth.
 */

/** Standard vial, 600px — use for cards, thumbnails and grids. */
export const VIAL_FALLBACK = '/products/vial-default-600.png'

/** Standard vial, full size — use for the large product-detail image. */
export const VIAL_FALLBACK_LARGE = '/products/vial-default.png'

interface HasImages {
  images?: { url: string }[] | null
}

/**
 * The image to render for a product, falling back to the standard vial.
 *
 * `large` picks the full-size asset for hero/detail use. Returns a path that
 * always exists, so callers never need their own `??`.
 */
export function productImage(product: HasImages | null | undefined, large = false): string {
  const uploaded = product?.images?.[0]?.url
  if (uploaded) return uploaded
  return large ? VIAL_FALLBACK_LARGE : VIAL_FALLBACK
}

/** True when we are showing the placeholder rather than a real photo. */
export function isFallbackImage(product: HasImages | null | undefined): boolean {
  return !product?.images?.[0]?.url
}
