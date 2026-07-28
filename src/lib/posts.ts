import 'server-only'

import { prisma } from '@/lib/prisma'
import { blogPosts, type BlogPost } from '@/lib/blog-data'

/**
 * DB-backed blog content. Public pages read PUBLISHED posts from the `posts`
 * table (managed via Admin → Blog). If the table isn't migrated yet the queries
 * throw and we fall back to the legacy static posts in blog-data.ts, so the blog
 * never goes blank during the migration window. Once the table exists it is the
 * single source of truth (a deleted post stays deleted — no static resurrection).
 */

export type PublicPost = BlogPost

type RelatedLink = { href: string; label: string }

function toReadTime(html: string, stored?: string | null): string {
  if (stored && stored.trim()) return stored
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.round(words / 200))} min read`
}

interface DbPostRow {
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  readTime: string | null
  relatedLinks: unknown
  publishedAt: Date | null
  createdAt: Date
}

function toPublic(p: DbPostRow): PublicPost {
  const relatedLinks = Array.isArray(p.relatedLinks)
    ? (p.relatedLinks as RelatedLink[]).filter((l) => l && l.href && l.label)
    : []
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    date: (p.publishedAt ?? p.createdAt).toISOString().slice(0, 10),
    readTime: toReadTime(p.content, p.readTime),
    category: p.category,
    content: p.content,
    relatedLinks,
  }
}

export async function getPublishedPosts(): Promise<PublicPost[]> {
  try {
    const rows = await prisma.post.findMany({
      where: { published: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    })
    return rows.map(toPublic)
  } catch {
    return blogPosts // table not migrated yet — legacy static fallback
  }
}

export async function getPostBySlug(slug: string): Promise<PublicPost | null> {
  try {
    const p = await prisma.post.findFirst({ where: { slug, published: true } })
    return p ? toPublic(p) : null
  } catch {
    return blogPosts.find((b) => b.slug === slug) ?? null
  }
}

/** All published slugs, for generateStaticParams / sitemap. */
export async function getPublishedSlugs(): Promise<string[]> {
  try {
    const rows = await prisma.post.findMany({
      where: { published: true },
      select: { slug: true },
    })
    return rows.map((r) => r.slug)
  } catch {
    return blogPosts.map((b) => b.slug)
  }
}
