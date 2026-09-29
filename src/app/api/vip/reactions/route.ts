import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    postId: z.string().max(64).optional(),
    commentId: z.string().max(64).optional(),
  })
  .refine((v) => !!v.postId !== !!v.commentId, 'Exactly one of postId / commentId')

/**
 * POST /api/vip/reactions {postId|commentId} — toggle a like.
 * Returns { liked, count }.
 */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate

  const wait = memberRateLimit(req, 'reaction', viewer.userId)
  if (wait) return vipJson({ error: 'Slow down a little.', retryAfter: wait }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid reaction' }, { status: 400 })
  const { postId, commentId } = parsed.data

  if (postId) {
    const post = await prisma.vipPost.findUnique({ where: { id: postId }, select: { hiddenAt: true } })
    if (!post || post.hiddenAt) return vipJson({ error: 'Not found' }, { status: 404 })
  } else {
    const c = await prisma.vipComment.findUnique({ where: { id: commentId! }, select: { hiddenAt: true } })
    if (!c || c.hiddenAt) return vipJson({ error: 'Not found' }, { status: 404 })
  }

  const where = postId
    ? { userId: viewer.userId, postId, kind: 'LIKE' }
    : { userId: viewer.userId, commentId: commentId!, kind: 'LIKE' }
  const existing = await prisma.vipReaction.findFirst({ where, select: { id: true } })
  let liked: boolean
  if (existing) {
    await prisma.vipReaction.delete({ where: { id: existing.id } })
    liked = false
  } else {
    try {
      await prisma.vipReaction.create({ data: where })
    } catch {
      // double-tap race: the unique key already holds the like
    }
    liked = true
  }
  const count = await prisma.vipReaction.count({
    where: postId ? { postId, kind: 'LIKE' } : { commentId: commentId!, kind: 'LIKE' },
  })
  return vipJson({ liked, count })
}
