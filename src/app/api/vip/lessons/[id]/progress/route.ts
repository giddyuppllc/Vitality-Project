import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { lessonAccess } from '@/lib/vip/classroom'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string, accessTier: Parameters<typeof lessonAccess>[1]) {
  const lesson = await prisma.vipLesson.findUnique({
    where: { id },
    include: { module: { include: { course: true } } },
  })
  if (!lesson) return null
  return lessonAccess(lesson, accessTier)
}

/** POST /api/vip/lessons/:id/progress — mark a lesson complete. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const access = await load(id, gate.viewer.accessTier)
  if (!access) return vipJson({ error: 'Not found' }, { status: 404 })
  if (!access.allowed) return vipJson({ error: 'tier_required', minTier: access.minTier }, { status: 403 })
  await prisma.vipLessonProgress.upsert({
    where: { userId_lessonId: { userId: gate.viewer.userId, lessonId: id } },
    update: {},
    create: { userId: gate.viewer.userId, lessonId: id },
  })
  return vipJson({ ok: true, completed: true })
}

/** DELETE /api/vip/lessons/:id/progress — mark a lesson not complete. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  await prisma.vipLessonProgress.deleteMany({ where: { userId: gate.viewer.userId, lessonId: id } })
  return vipJson({ ok: true, completed: false })
}
