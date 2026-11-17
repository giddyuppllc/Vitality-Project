import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson, type VipViewer } from '@/lib/vip/access'
import { lessonAccess } from '@/lib/vip/classroom'
import { completeLesson, hasCourseGrant } from '@/lib/vip/academy'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string, viewer: VipViewer) {
  const lesson = await prisma.vipLesson.findUnique({
    where: { id },
    include: { module: { include: { course: true } } },
  })
  if (!lesson) return null
  const granted = await hasCourseGrant(viewer.userId, lesson.module.courseId)
  return lessonAccess(lesson, viewer.accessTier, { granted, isAdmin: viewer.isAdmin })
}

/**
 * POST /api/vip/lessons/:id/progress — mark a lesson complete. Awards the
 * lesson's points once (and the course's, with its certificate, when this
 * finishes the course).
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const access = await load(id, gate.viewer)
  if (!access) return vipJson({ error: 'Not found' }, { status: 404 })
  if (!access.allowed) return vipJson({ error: 'tier_required', minTier: access.minTier }, { status: 403 })
  const r = await completeLesson(gate.viewer.userId, id)
  return vipJson({
    ok: true,
    completed: true,
    pointsAwarded: r.lessonPoints + r.coursePoints,
    courseCompleted: r.courseCompleted,
    certificateCode: r.certificateCode,
  })
}

/** DELETE /api/vip/lessons/:id/progress — mark a lesson not complete (points already earned stay). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  await prisma.vipLessonProgress.deleteMany({ where: { userId: gate.viewer.userId, lessonId: id } })
  return vipJson({ ok: true, completed: false })
}
