import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { MAX_COMMENT_CHARS, memberRateLimit, spamCheck } from '@/lib/vip/guard'
import { notifyForContent } from '@/lib/vip/notify'

export const dynamic = 'force-dynamic'

const schema = z.object({
  body: z.string().max(MAX_COMMENT_CHARS),
  parentId: z.string().max(64).nullish(),
})

/**
 * POST /api/vip/posts/:id/comments — comment on a post, or reply to a
 * top-level comment. Threads are ONE level deep: replying to a reply attaches
 * to that reply's parent instead.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate
  const { id: postId } = await params

  const wait = memberRateLimit(req, 'comment', viewer.userId)
  if (wait) return vipJson({ error: 'You are commenting too quickly. Try again shortly.', retryAfter: wait }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid comment' }, { status: 400 })
  const body = parsed.data.body.trim()

  const post = await prisma.vipPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, hiddenAt: true },
  })
  if (!post || post.hiddenAt) return vipJson({ error: 'Not found' }, { status: 404 })

  let parentId: string | null = null
  let parentAuthorId: string | undefined
  if (parsed.data.parentId) {
    const parent = await prisma.vipComment.findUnique({
      where: { id: parsed.data.parentId },
      select: { id: true, postId: true, parentId: true, authorId: true, hiddenAt: true },
    })
    if (!parent || parent.postId !== postId || parent.hiddenAt) {
      return vipJson({ error: 'That comment is not available.' }, { status: 400 })
    }
    parentId = parent.parentId ?? parent.id // flatten to one level
    parentAuthorId = parent.authorId
  }

  const spam = await spamCheck({ kind: 'comment', userId: viewer.userId, body })
  if (spam) return vipJson({ error: spam }, { status: 422 })

  const comment = await prisma.vipComment.create({
    data: { postId, authorId: viewer.userId, parentId, body },
    select: { id: true },
  })
  await notifyForContent({
    actorId: viewer.userId,
    body,
    postId,
    commentId: comment.id,
    postAuthorId: post.authorId,
    parentAuthorId,
  })
  return vipJson({ ok: true, id: comment.id, parentId }, { status: 201 })
}
