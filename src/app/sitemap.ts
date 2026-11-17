import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getPublishedPosts } from '@/lib/posts'
import { availableStacks } from '@/lib/stack-availability'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

export const revalidate = 3600 // regenerate hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/', changeFrequency: 'daily', priority: 1.0 },
    { path: '/products', changeFrequency: 'daily', priority: 0.9 },
    { path: '/shop', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/stacks', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/coa', changeFrequency: 'weekly', priority: 0.6 },
    { path: '/contact', changeFrequency: 'yearly', priority: 0.4 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/research', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/membership', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/affiliate', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/refer', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/what-are-peptides', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/how-peptides-work', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/peptides-benefits', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/peptides-safety', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/peptides-legality', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/synthetic-vs-natural-peptides', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/bioactive-peptides', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/peptide-signaling-explained', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/shipping', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
    // /business itself redirects to sign-in (and is disallowed in robots);
    // the public partner page is /business/apply.
    { path: '/business/apply', changeFrequency: 'monthly', priority: 0.5 },
  ]

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  let productEntries: MetadataRoute.Sitemap = []
  try {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { slug: true, updatedAt: true },
    })
    productEntries = products.map((p) => ({
      url: `${BASE_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))
  } catch {
    /* ignore — build-time DB may not be available */
  }

  // Category landing pages that have something on sale, and stacks that can
  // actually be bought (lib/stack-availability) — neither was listed before.
  let categoryEntries: MetadataRoute.Sitemap = []
  let stackEntries: MetadataRoute.Sitemap = []
  try {
    const cats = await prisma.category.findMany({
      where: { products: { some: { status: 'ACTIVE' } } },
      select: { slug: true },
    })
    categoryEntries = cats.map((c) => ({
      url: `${BASE_URL}/shop/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))
    stackEntries = (await availableStacks()).map(({ stack }) => ({
      url: `${BASE_URL}/stacks/${stack.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))
  } catch {
    /* ignore — build-time DB may not be available */
  }

  // Published posts from the DB (the blog's own source). The sitemap used the
  // legacy static list, so posts published from /admin never appeared and an
  // unpublished legacy post would stay listed. getPublishedPosts() falls back
  // to the static list itself when the posts table is unavailable.
  const posts = await getPublishedPosts()
  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticEntries, ...categoryEntries, ...productEntries, ...stackEntries, ...blogEntries]
}
