import type { MembershipTier, VipArticleCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from '@/lib/vip/access'

/**
 * Lifestyle library: coach-written guides on nutrition, recovery, sleep,
 * mindset and recipes. Same gating rule as the classroom — unpublished
 * articles don't exist for members; a member below the tier sees the title
 * and summary, never the body.
 */

export const ARTICLE_CATEGORIES: { value: VipArticleCategory; label: string; slug: string }[] = [
  { value: 'NUTRITION', label: 'Nutrition', slug: 'nutrition' },
  { value: 'RECOVERY', label: 'Recovery', slug: 'recovery' },
  { value: 'SLEEP', label: 'Sleep', slug: 'sleep' },
  { value: 'MINDSET', label: 'Mindset', slug: 'mindset' },
  { value: 'RECIPES', label: 'Recipes', slug: 'recipes' },
]

export const categoryLabel = (c: VipArticleCategory) => ARTICLE_CATEGORIES.find((x) => x.value === c)?.label ?? c
export const categoryFromSlug = (s: string | undefined) => ARTICLE_CATEGORIES.find((x) => x.slug === s)?.value

/** ~220 words a minute, at least 1. */
export function readMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

export async function listArticles(accessTier: MembershipTier, category?: VipArticleCategory) {
  const rows = await prisma.vipArticle.findMany({
    where: { published: true, ...(category ? { category } : {}) },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: { id: true, slug: true, title: true, summary: true, coverImage: true, category: true, minTier: true, publishedAt: true, body: true },
  })
  return rows.map(({ body, ...a }) => ({ ...a, minutes: readMinutes(body), allowed: tierAllows(accessTier, a.minTier) }))
}

export async function getArticle(slug: string, accessTier: MembershipTier) {
  const a = await prisma.vipArticle.findUnique({ where: { slug } })
  if (!a || !a.published) return null
  const allowed = tierAllows(accessTier, a.minTier)
  return {
    article: { ...a, body: allowed ? a.body : '' },
    allowed,
    minutes: readMinutes(a.body),
  }
}
