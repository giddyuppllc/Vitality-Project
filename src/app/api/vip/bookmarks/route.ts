import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { getPostView, listBookmarks } from '@/lib/vip/feed'
import { memberRateLimit } from '@/lib/vip/guard'

export const dynamic = 'force-dynamic'

/** GET /api/vip/bookmarks?cursor= — the viewer's saved posts. */
export async function GET(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  return vipJson(await listBookmarks({ viewer: gate.viewer, cursor: req.nextUrl.searchParams.get('cursor') }))
}

const schema = z.object({ postId: z.string().max(64), saved: z.boolean().optional() })

/**
 * POST /api/vip/bookmarks {postId, saved?} — save / unsave a post. Without
 * `saved` it toggles. Returns { saved }.
 */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate
  const wait = memberRateLimit(req, 'bookmark', viewer.userId)
  if (wait) return vipJson({ error: 'Slow down a little.', retryAfter: wait }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid request' }, { status: 400 })
  const { postId } = parsed.data

  const existing = await prisma.vipBookmark.findUnique({
    where: { userId_postId: { userId: viewer.userId, postId } },
    select: { id: true },
  })
  const want = parsed.data.saved ?? !existing
  if (!want) {
    if (existing) await prisma.vipBookmark.delete({ where: { id: existing.id } })
    return vipJson({ saved: false })
  }
  if (!(await getPostView(viewer, postId))) return vipJson({ error: 'Not found' }, { status: 404 })
  if (!existing) {
    try {
      await prisma.vipBookmark.create({ data: { userId: viewer.userId, postId } })
    } catch {
      // double-tap race: the unique key already holds the bookmark
    }
  }
  return vipJson({ saved: true })
}
