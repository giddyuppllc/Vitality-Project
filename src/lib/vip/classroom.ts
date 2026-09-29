import type { MembershipTier, VipCourse, VipLesson, VipModule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from './access'

/**
 * Classroom + events tier gating. A lesson's requirement is its own minTier
 * if set, else its course's. Unpublished courses/lessons/events do not exist
 * as far as members are concerned (404, never a teaser).
 */

type LessonWithCourse = VipLesson & { module: VipModule & { course: VipCourse } }

export function effectiveLessonTier(lesson: LessonWithCourse): MembershipTier {
  return lesson.minTier ?? lesson.module.course.minTier
}

/** null = not visible at all (unpublished). */
export function lessonAccess(
  lesson: LessonWithCourse,
  accessTier: MembershipTier,
): { allowed: boolean; minTier: MembershipTier } | null {
  if (!lesson.published || !lesson.module.course.published) return null
  const minTier = effectiveLessonTier(lesson)
  return { allowed: tierAllows(accessTier, minTier), minTier }
}

export async function listCourses(userId: string, accessTier: MembershipTier) {
  const courses = await prisma.vipCourse.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      modules: {
        select: {
          lessons: { where: { published: true }, select: { id: true } },
        },
      },
    },
  })
  const lessonIds = courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)))
  const done = new Set(
    (
      await prisma.vipLessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    ).map((p) => p.lessonId),
  )
  return courses.map((c) => {
    const ids = c.modules.flatMap((m) => m.lessons.map((l) => l.id))
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      coverImage: c.coverImage,
      minTier: c.minTier,
      allowed: tierAllows(accessTier, c.minTier),
      lessonCount: ids.length,
      completedCount: ids.filter((id) => done.has(id)).length,
    }
  })
}

export async function getCourse(slug: string, userId: string, accessTier: MembershipTier) {
  const course = await prisma.vipCourse.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          lessons: {
            where: { published: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  })
  if (!course || !course.published) return null
  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id))
  const done = new Set(
    (
      await prisma.vipLessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    ).map((p) => p.lessonId),
  )
  return {
    course,
    allowed: tierAllows(accessTier, course.minTier),
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => {
        const minTier = l.minTier ?? course.minTier
        return {
          id: l.id,
          title: l.title,
          minTier,
          allowed: tierAllows(accessTier, minTier),
          completed: done.has(l.id),
        }
      }),
    })),
    completedCount: lessonIds.filter((id) => done.has(id)).length,
    lessonCount: lessonIds.length,
  }
}

export async function getLesson(id: string, userId: string, accessTier: MembershipTier) {
  const lesson = await prisma.vipLesson.findUnique({
    where: { id },
    include: { module: { include: { course: true } } },
  })
  if (!lesson) return null
  const access = lessonAccess(lesson, accessTier)
  if (!access) return null
  const done = await prisma.vipLessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId: id } },
  })
  return { lesson, ...access, completed: !!done }
}

// ─── Events ────────────────────────────────────────────────────────────────

export async function listUpcomingEvents(userId: string, accessTier: MembershipTier, now = new Date()) {
  const events = await prisma.vipEvent.findMany({
    where: {
      published: true,
      cancelledAt: null,
      // still upcoming, or started within the last 3 hours (live now)
      OR: [{ startsAt: { gte: new Date(now.getTime() - 3 * 3600e3) } }, { endsAt: { gte: now } }],
    },
    orderBy: { startsAt: 'asc' },
    include: {
      _count: { select: { rsvps: true } },
      rsvps: { where: { userId }, select: { id: true } },
    },
    take: 50,
  })
  return events.map((e) => {
    const allowed = tierAllows(accessTier, e.minTier)
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
      minTier: e.minTier,
      allowed,
      // The join link is only ever sent to members who meet the tier.
      joinUrl: allowed ? e.joinUrl : null,
      rsvpCount: e._count.rsvps,
      going: e.rsvps.length > 0,
    }
  })
}

export async function eventAccess(eventId: string, accessTier: MembershipTier) {
  const e = await prisma.vipEvent.findUnique({ where: { id: eventId } })
  if (!e || !e.published || e.cancelledAt) return null
  return { event: e, allowed: tierAllows(accessTier, e.minTier) }
}
