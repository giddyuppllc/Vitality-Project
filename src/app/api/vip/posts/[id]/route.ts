import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { getThread } from '@/lib/vip/feed'
import { MAX_POST_CHARS, MAX_POST_IMAGES, spamCheck } from '@/lib/vip/guard'
import { isVipMediaUrl } from '@/lib/vip/media'
import { notifyForContent } from '@/lib/vip/notify'
import { syncPostHashtags } from '@/lib/vip/hashtags'
import { checkVideoUrl } from '@/lib/vip/text'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/vip/posts/:id — a post and its (one-level) comment thread. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const thread = await getThread(gate.viewer, id)
  if (!thread) return vipJson({ error: 'Not found' }, { status: 404 })
  return vipJson(thread)
}

const editSchema = z.object({
  body: z.string().max(MAX_POST_CHARS),
  /** Omit to keep the photos as they are; [] removes them all. */
  images: z.array(z.string().max(200)).max(MAX_POST_IMAGES).optional(),
  /** Omit to keep; null or '' removes the video link. */
  videoUrl: z.string().trim().max(500).nullish(),
})

/**
 * PATCH /api/vip/posts/:id — the author edits their own post (body, photos,
 * video link). Marked "edited"; hashtags re-indexed; only NEW @mentions are
 * notified.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const post = await prisma.vipPost.findUnique({
    where: { id },
    select: { authorId: true, hiddenAt: true, body: true, createdAt: true },
  })
  if (!post || post.hiddenAt) return vipJson({ error: 'Not found' }, { status: 404 })
  if (post.authorId !== gate.viewer.userId) return vipJson({ error: 'Forbidden' }, { status: 403 })

  const parsed = editSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid post' }, { status: 400 })
  const body = parsed.data.body.trim()
  const images = parsed.data.images ? [...new Set(parsed.data.images)] : undefined
  if (images?.some((u) => !isVipMediaUrl(u))) {
    return vipJson({ error: 'Images must be uploaded through the clubhouse.' }, { status: 400 })
  }
  let videoUrl: string | null | undefined
  if (parsed.data.videoUrl !== undefined) {
    const v = checkVideoUrl(parsed.data.videoUrl)
    if (v === false) return vipJson({ error: 'Video links must be YouTube or Vimeo.' }, { status: 400 })
    videoUrl = v
  }
  const spam = await spamCheck({ kind: 'post', userId: gate.viewer.userId, body, excludeId: id })
  if (spam) return vipJson({ error: spam }, { status: 422 })

  await prisma.$transaction(async (tx) => {
    await tx.vipPost.update({
      where: { id },
      data: {
        body,
        editedAt: new Date(),
        ...(videoUrl !== undefined ? { videoUrl } : {}),
        ...(images ? { imageUrl: images[0] ?? null } : {}),
      },
    })
    if (images) {
      await tx.vipPostImage.deleteMany({ where: { postId: id } })
      if (images.length) {
        await tx.vipPostImage.createMany({ data: images.map((url, i) => ({ postId: id, url, sortOrder: i })) })
      }
    }
    await syncPostHashtags(id, body, post.createdAt, tx)
  })
  await notifyForContent({ actorId: gate.viewer.userId, body, postId: id, previousBody: post.body })
  return vipJson({ ok: true })
}

/** DELETE /api/vip/posts/:id — the author removes their own post. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const post = await prisma.vipPost.findUnique({ where: { id }, select: { authorId: true } })
  if (!post) return vipJson({ error: 'Not found' }, { status: 404 })
  if (post.authorId !== gate.viewer.userId) return vipJson({ error: 'Forbidden' }, { status: 403 })
  await prisma.vipPost.delete({ where: { id } })
  return vipJson({ ok: true })
}
