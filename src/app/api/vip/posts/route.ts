import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { listFeed } from '@/lib/vip/feed'
import { memberRateLimit, spamCheck, MAX_POST_CHARS } from '@/lib/vip/guard'
import { isVipMediaUrl } from '@/lib/vip/media'
import { notifyForContent } from '@/lib/vip/notify'

export const dynamic = 'force-dynamic'

/** GET /api/vip/posts?space=&q=&cursor= — the members-only feed. */
export async function GET(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const sp = req.nextUrl.searchParams
  const feed = await listFeed({
    viewer: gate.viewer,
    space: sp.get('space'),
    q: sp.get('q'),
    cursor: sp.get('cursor'),
  })
  return vipJson(feed)
}

const createSchema = z.object({
  body: z.string().max(MAX_POST_CHARS),
  spaceId: z.string().max(64).nullish(),
  imageUrl: z.string().max(200).nullish(),
  isAnnouncement: z.boolean().optional(),
})

/** POST /api/vip/posts — start a post. */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate

  const wait = memberRateLimit(req, 'post', viewer.userId)
  if (wait) return vipJson({ error: 'You are posting too quickly. Try again shortly.', retryAfter: wait }, { status: 429 })

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid post' }, { status: 400 })
  const { spaceId, imageUrl } = parsed.data
  const body = parsed.data.body.trim()

  if (imageUrl && !isVipMediaUrl(imageUrl)) {
    return vipJson({ error: 'Images must be uploaded through the clubhouse.' }, { status: 400 })
  }
  if (spaceId) {
    const space = await prisma.vipSpace.findUnique({ where: { id: spaceId } })
    if (!space || space.archived) return vipJson({ error: 'That space does not exist.' }, { status: 400 })
    if (space.adminOnly && !viewer.isAdmin) {
      return vipJson({ error: 'Only the team can post in this space.' }, { status: 403 })
    }
  }
  const spam = await spamCheck({ kind: 'post', userId: viewer.userId, body })
  if (spam) return vipJson({ error: spam }, { status: 422 })

  const post = await prisma.vipPost.create({
    data: {
      authorId: viewer.userId,
      body,
      spaceId: spaceId || null,
      imageUrl: imageUrl || null,
      // Announcements are an admin-only flag.
      isAnnouncement: viewer.isAdmin ? !!parsed.data.isAnnouncement : false,
    },
    select: { id: true },
  })
  await notifyForContent({ actorId: viewer.userId, body, postId: post.id })
  return vipJson({ ok: true, id: post.id }, { status: 201 })
}
