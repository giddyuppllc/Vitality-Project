import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimitKey } from '@/lib/rate-limit'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { lessonAccess } from '@/lib/vip/classroom'
import { hasCourseGrant } from '@/lib/vip/academy'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const MAX_NOTE_CHARS = 20_000
const schema = z.object({ body: z.string().max(MAX_NOTE_CHARS) })

/**
 * PUT /api/vip/lessons/:id/note — save the member's private note for a
 * lesson (empty body deletes it). Notes are only ever read back by their
 * author: every query is keyed by the signed-in member's id.
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const v = gate.viewer
  const lesson = await prisma.vipLesson.findUnique({ where: { id }, include: { module: { include: { course: true } } } })
  if (!lesson) return vipJson({ error: 'Not found' }, { status: 404 })
  const access = lessonAccess(lesson, v.accessTier, { granted: await hasCourseGrant(v.userId, lesson.module.courseId), isAdmin: v.isAdmin })
  if (!access) return vipJson({ error: 'Not found' }, { status: 404 })
  if (!access.allowed) return vipJson({ error: 'tier_required', minTier: access.minTier }, { status: 403 })

  const limit = checkRateLimitKey(`vip:note:${v.userId}`, { limit: 240, windowMs: 60 * 60_000 })
  if (!limit.allowed) return vipJson({ error: 'Saving too often — try again shortly.', retryAfter: limit.retryAfter }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: `Notes can be up to ${MAX_NOTE_CHARS.toLocaleString('en-US')} characters.` }, { status: 400 })
  const body = parsed.data.body
  if (!body.trim()) {
    await prisma.vipLessonNote.deleteMany({ where: { userId: v.userId, lessonId: id } })
    return vipJson({ ok: true, saved: false, updatedAt: null })
  }
  const note = await prisma.vipLessonNote.upsert({
    where: { userId_lessonId: { userId: v.userId, lessonId: id } },
    update: { body },
    create: { userId: v.userId, lessonId: id, body },
  })
  return vipJson({ ok: true, saved: true, updatedAt: note.updatedAt.toISOString() })
}
