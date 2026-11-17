import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { listFeed } from '@/lib/vip/feed'
import { memberRateLimit, spamCheck, MAX_POST_CHARS, MAX_POST_IMAGES } from '@/lib/vip/guard'
import { isVipMediaUrl } from '@/lib/vip/media'
import { notifyForContent } from '@/lib/vip/notify'
import { syncPostHashtags } from '@/lib/vip/hashtags'
import { awardPostPoints } from '@/lib/vip/engagement'
import { checkVideoUrl, normaliseTag } from '@/lib/vip/text'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vip/posts?space=&q=&cursor=&tab=following&tag=&author= — the
 * members-only feed. tab=following: only people the viewer follows. tag: a
 * #hashtag. author: one member's posts (their profile grid).
 */
export async function GET(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const sp = req.nextUrl.searchParams
  const tag = sp.get('tag')
  const feed = await listFeed({
    viewer: gate.viewer,
    space: sp.get('space'),
    q: sp.get('q'),
    cursor: sp.get('cursor'),
    following: sp.get('tab') === 'following',
    tag: tag ? normaliseTag(tag) ?? '__none__' : null,
    authorId: sp.get('author'),
  })
  return vipJson(feed)
}

const createSchema = z.object({
  body: z.string().max(MAX_POST_CHARS),
  spaceId: z.string().max(64).nullish(),
  imageUrl: z.string().max(200).nullish(),
  images: z.array(z.string().max(200)).max(MAX_POST_IMAGES).optional(),
  videoUrl: z.string().trim().max(500).nullish(),
  isAnnouncement: z.boolean().optional(),
})

/** POST /api/vip/posts — start a post (up to 6 images, an optional video link). */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate

  const wait = memberRateLimit(req, 'post', viewer.userId)
  if (wait) return vipJson({ error: 'You are posting too quickly. Try again shortly.', retryAfter: wait }, { status: 429 })

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((i) => i.path[0] === 'images')
    return vipJson({ error: tooMany ? `Add up to ${MAX_POST_IMAGES} photos.` : 'Invalid post' }, { status: 400 })
  }
  const { spaceId } = parsed.data
  const body = parsed.data.body.trim()
  const images = [...new Set([...(parsed.data.images ?? []), ...(parsed.data.imageUrl ? [parsed.data.imageUrl] : [])])]
  if (images.length > MAX_POST_IMAGES) return vipJson({ error: `Add up to ${MAX_POST_IMAGES} photos.` }, { status: 400 })
  if (images.some((u) => !isVipMediaUrl(u))) {
    return vipJson({ error: 'Images must be uploaded through the clubhouse.' }, { status: 400 })
  }
  const videoUrl = checkVideoUrl(parsed.data.videoUrl)
  if (videoUrl === false) return vipJson({ error: 'Video links must be YouTube or Vimeo.' }, { status: 400 })

  if (spaceId) {
    const space = await prisma.vipSpace.findUnique({ where: { id: spaceId } })
    if (!space || space.archived) return vipJson({ error: 'That space does not exist.' }, { status: 400 })
    if (space.adminOnly && !viewer.isAdmin) {
      return vipJson({ error: 'Only the team can post in this space.' }, { status: 403 })
    }
  }
  const spam = await spamCheck({ kind: 'post', userId: viewer.userId, body })
  if (spam) return vipJson({ error: spam }, { status: 422 })

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.vipPost.create({
      data: {
        authorId: viewer.userId,
        body,
        spaceId: spaceId || null,
        // The first image also lives on imageUrl, for anything that reads the older field.
        imageUrl: images[0] ?? null,
        videoUrl,
        // Announcements are an admin-only flag.
        isAnnouncement: viewer.isAdmin ? !!parsed.data.isAnnouncement : false,
        images: { create: images.map((url, i) => ({ url, sortOrder: i })) },
      },
      select: { id: true, createdAt: true },
    })
    await syncPostHashtags(created.id, body, created.createdAt, tx)
    return created
  })
  await notifyForContent({ actorId: viewer.userId, body, postId: post.id })
  const points = await awardPostPoints(viewer.userId, post.createdAt)
  return vipJson({ ok: true, id: post.id, points }, { status: 201 })
}
