import { prisma } from '@/lib/prisma'
import { purgeProductCache } from '@/lib/cloudflare-purge'

/**
 * Re-normalise a product's image set after any add / delete / reorder:
 *
 *  1. Repack `position` to a gap-free 0..n-1 sequence (stable by current
 *     position, then id) so "first image" is always position 0 — the storefront
 *     card and the detail-page gallery both read the first image by position.
 *  2. Purge the Cloudflare edge cache for the product's URLs so the new card
 *     image is visible to shoppers immediately, not at the next TTL expiry.
 *
 * Fire the purge-and-forget; the admin mutation isn't blocked on it.
 */
export async function resyncProductImages(productId: string): Promise<void> {
  const images = await prisma.productImage.findMany({
    where: { productId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  })

  await prisma.$transaction(
    images.map((img, i) =>
      prisma.productImage.update({ where: { id: img.id }, data: { position: i } }),
    ),
  )

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  })
  if (product) {
    void purgeProductCache({ slug: product.slug }).catch((err) =>
      console.error('[product-images] cloudflare purge failed:', err),
    )
  }
}
