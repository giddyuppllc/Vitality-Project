import type { Prisma } from '@prisma/client'

/**
 * The columns a PUBLIC product endpoint may return.
 *
 * `/api/products` and `/api/products/search` used `include`, which returns
 * every scalar on the row — including `cost` (our cost of goods), `barcode`,
 * `trackInventory` and the raw SEO fields. Anyone could read the margin on
 * every product with one unauthenticated GET. Public endpoints select from
 * this list instead; admin endpoints keep their own queries.
 */
export const PUBLIC_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  shortDesc: true,
  price: true,
  comparePrice: true,
  featured: true,
  tags: true,
  images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, alt: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect

/** Parse a `?limit=` query value: default when absent/garbage, clamped to [1, max]. */
export function parseLimit(raw: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, max)
}
