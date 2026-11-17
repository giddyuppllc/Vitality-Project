import { prisma } from '@/lib/prisma'
import type { Tx } from './points'
import { extractHashtags } from './text'

/**
 * #hashtags: indexed per post in vip_post_hashtags (createdAt = the post's
 * createdAt, so an edit never makes an old post "trend").
 */

export async function syncPostHashtags(
  postId: string,
  body: string,
  postCreatedAt: Date,
  db: Tx = prisma,
): Promise<string[]> {
  const tags = extractHashtags(body)
  await db.vipPostHashtag.deleteMany({ where: { postId, ...(tags.length ? { tag: { notIn: tags } } : {}) } })
  if (tags.length) {
    await db.vipPostHashtag.createMany({
      data: tags.map((tag) => ({ postId, tag, createdAt: postCreatedAt })),
      skipDuplicates: true,
    })
  }
  return tags
}

export interface TagCount {
  tag: string
  count: number
}

/** Most-used hashtags on visible posts in the last `days` days. */
export async function trendingHashtags(opts: { days?: number; take?: number } = {}): Promise<TagCount[]> {
  const since = new Date(Date.now() - (opts.days ?? 7) * 24 * 3600e3)
  const rows = await prisma.vipPostHashtag.groupBy({
    by: ['tag'],
    where: { createdAt: { gte: since }, post: { hiddenAt: null } },
    _count: { _all: true },
    orderBy: [{ _count: { tag: 'desc' } }, { tag: 'asc' }],
    take: opts.take ?? 10,
  })
  return rows.map((r) => ({ tag: r.tag, count: r._count._all }))
}

/** Hashtags matching a search term (prefix first), with all-time post counts. */
export async function searchHashtags(term: string, take = 12): Promise<TagCount[]> {
  const t = term.trim().replace(/^#+/, '').toLowerCase().slice(0, 40)
  if (!t || !/^[a-z0-9_]+$/.test(t)) return []
  const rows = await prisma.vipPostHashtag.groupBy({
    by: ['tag'],
    where: { tag: { contains: t }, post: { hiddenAt: null } },
    _count: { _all: true },
    orderBy: [{ _count: { tag: 'desc' } }, { tag: 'asc' }],
    take: 50,
  })
  return rows
    .map((r) => ({ tag: r.tag, count: r._count._all }))
    .sort((a, b) => Number(b.tag.startsWith(t)) - Number(a.tag.startsWith(t)) || b.count - a.count)
    .slice(0, take)
}

export async function hashtagPostCount(tag: string): Promise<number> {
  return prisma.vipPostHashtag.count({ where: { tag, post: { hiddenAt: null } } })
}
