import type { MembershipTier, VipCourse, VipLesson, VipModule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from './access'
import { allowsTier, grantedCourseIds, hasCourseGrant, isPurchasable, quizOptions } from './academy'

/**
 * Classroom (Academy) + events tier gating. A lesson's requirement is its own
 * minTier if set, else its course's. A VipCourseGrant (points, purchase,
 * admin) opens the whole course regardless of tier; a purchase-only course
 * opens ONLY with a grant (lib/vip/academy.ts). Unpublished courses / lessons
 * / events do not exist as far as members are concerned (404, never a teaser).
 */

type LessonWithCourse = VipLesson & { module: VipModule & { course: VipCourse } }

export interface GateOpts {
  /** Member holds a VipCourseGrant for this lesson's course. */
  granted?: boolean
  isAdmin?: boolean
}

export function effectiveLessonTier(lesson: LessonWithCourse): MembershipTier {
  return lesson.minTier ?? lesson.module.course.minTier
}

/** null = not visible at all (unpublished). */
export function lessonAccess(
  lesson: LessonWithCourse,
  accessTier: MembershipTier,
  opts: GateOpts = {},
): { allowed: boolean; minTier: MembershipTier } | null {
  if (!lesson.published || !lesson.module.course.published) return null
  const minTier = effectiveLessonTier(lesson)
  return { allowed: allowsTier(lesson.module.course, minTier, accessTier, opts), minTier }
}

function purchaseView(c: VipCourse) {
  return {
    purchaseOnly: !!c.purchaseOnly,
    priceCents: c.priceCents && c.priceCents > 0 ? c.priceCents : null,
    pointsPrice: c.pointsPrice && c.pointsPrice > 0 ? c.pointsPrice : null,
    purchasable: isPurchasable(c),
  }
}

export async function listCourses(userId: string, accessTier: MembershipTier, opts: { isAdmin?: boolean } = {}) {
  const courses = await prisma.vipCourse.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      track: { select: { id: true, slug: true, title: true, published: true } },
      modules: {
        select: {
          lessons: { where: { published: true }, select: { id: true } },
        },
      },
    },
  })
  const lessonIds = courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)))
  const [doneRows, granted, certs] = await Promise.all([
    prisma.vipLessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } }, select: { lessonId: true } }),
    grantedCourseIds(userId),
    prisma.vipCertificate.findMany({ where: { userId }, select: { courseId: true, code: true } }),
  ])
  const done = new Set(doneRows.map((p) => p.lessonId))
  const certBy = new Map(certs.map((c) => [c.courseId, c.code]))
  return courses.map((c) => {
    const ids = c.modules.flatMap((m) => m.lessons.map((l) => l.id))
    const isGranted = granted.has(c.id)
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      coverImage: c.coverImage,
      minTier: c.minTier,
      level: c.level,
      estimatedMinutes: c.estimatedMinutes,
      sortOrder: c.sortOrder,
      track: c.track && c.track.published ? { id: c.track.id, slug: c.track.slug, title: c.track.title } : null,
      allowed: allowsTier(c, c.minTier, accessTier, { granted: isGranted, isAdmin: opts.isAdmin }),
      granted: isGranted,
      ...purchaseView(c),
      lessonCount: ids.length,
      completedCount: ids.filter((id) => done.has(id)).length,
      certificateCode: certBy.get(c.id) ?? null,
    }
  })
}

export type CourseCard = Awaited<ReturnType<typeof listCourses>>[number]

export async function getCourse(slug: string, userId: string, accessTier: MembershipTier, opts: { isAdmin?: boolean } = {}) {
  const course = await prisma.vipCourse.findUnique({
    where: { slug },
    include: {
      track: { select: { slug: true, title: true, published: true } },
      modules: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          lessons: {
            where: { published: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, title: true, minTier: true, durationMinutes: true, videoUrl: true },
          },
          quiz: { select: { id: true, title: true, published: true, passPct: true, _count: { select: { questions: true } } } },
        },
      },
    },
  })
  if (!course || !course.published) return null
  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id))
  const quizIds = course.modules.flatMap((m) => (m.quiz ? [m.quiz.id] : []))
  const [doneRows, granted, passedRows, resume, cert] = await Promise.all([
    prisma.vipLessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } }, select: { lessonId: true } }),
    hasCourseGrant(userId, course.id),
    prisma.vipQuizAttempt.findMany({ where: { userId, quizId: { in: quizIds } }, select: { quizId: true, passed: true, scorePct: true } }),
    prisma.vipCourseResume.findUnique({ where: { userId_courseId: { userId, courseId: course.id } }, select: { lessonId: true } }),
    prisma.vipCertificate.findUnique({ where: { userId_courseId: { userId, courseId: course.id } }, select: { code: true, issuedAt: true } }),
  ])
  const done = new Set(doneRows.map((p) => p.lessonId))
  const best = new Map<string, { passed: boolean; scorePct: number }>()
  for (const a of passedRows) {
    const b = best.get(a.quizId)
    if (!b || a.scorePct > b.scorePct || (a.passed && !b.passed)) best.set(a.quizId, { passed: b?.passed || a.passed, scorePct: Math.max(b?.scorePct ?? 0, a.scorePct) })
  }
  const gate = { granted, isAdmin: opts.isAdmin }
  const modules = course.modules.map((m) => {
    const quiz = m.quiz && m.quiz.published && m.quiz._count.questions > 0 ? m.quiz : null
    const q = quiz ? best.get(quiz.id) : undefined
    return {
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => {
        const minTier = l.minTier ?? course.minTier
        return {
          id: l.id,
          title: l.title,
          minTier,
          durationMinutes: l.durationMinutes,
          hasVideo: !!l.videoUrl,
          allowed: allowsTier(course, minTier, accessTier, gate),
          completed: done.has(l.id),
        }
      }),
      quiz: quiz
        ? {
            id: quiz.id,
            title: quiz.title,
            questionCount: quiz._count.questions,
            passPct: quiz.passPct,
            passed: !!q?.passed,
            bestPct: q?.scorePct ?? null,
            // A module quiz opens when the member may open the module's lessons.
            allowed: m.lessons.length === 0 ? allowsTier(course, course.minTier, accessTier, gate) : m.lessons.some((l) => allowsTier(course, l.minTier ?? course.minTier, accessTier, gate)),
          }
        : null,
    }
  })
  const quizzes = modules.flatMap((m) => (m.quiz ? [m.quiz] : []))
  const completedCount = lessonIds.filter((id) => done.has(id)).length
  const allLessons = modules.flatMap((m) => m.lessons)
  const nextLesson = allLessons.find((l) => l.allowed && !l.completed) ?? null
  // Resume: the last lesson opened while it is unfinished, else the first
  // unfinished lesson (a finished last-opened lesson would skip work).
  const lastOpened = resume ? allLessons.find((l) => l.id === resume.lessonId && l.allowed) ?? null : null
  const resumeLesson = lastOpened && !lastOpened.completed ? lastOpened : nextLesson ?? lastOpened
  const totalSteps = lessonIds.length + quizzes.length
  const doneSteps = completedCount + quizzes.filter((q) => q.passed).length
  return {
    course,
    track: course.track && course.track.published ? { slug: course.track.slug, title: course.track.title } : null,
    allowed: allowsTier(course, course.minTier, accessTier, gate),
    granted,
    ...purchaseView(course),
    modules,
    completedCount,
    lessonCount: lessonIds.length,
    totalSteps,
    doneSteps,
    progressPct: totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0,
    resumeLesson,
    certificate: cert ? { code: cert.code, issuedAt: cert.issuedAt.toISOString() } : null,
  }
}

export async function getLesson(id: string, userId: string, accessTier: MembershipTier, opts: { isAdmin?: boolean } = {}) {
  const lesson = await prisma.vipLesson.findUnique({
    where: { id },
    include: {
      module: { include: { course: true, quiz: { select: { id: true, title: true, published: true, _count: { select: { questions: true } } } } } },
      resources: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { file: { select: { id: true, fileName: true, sizeBytes: true, mimeType: true } } } },
    },
  })
  if (!lesson) return null
  const granted = await hasCourseGrant(userId, lesson.module.courseId)
  const access = lessonAccess(lesson, accessTier, { granted, isAdmin: opts.isAdmin })
  if (!access) return null
  const [done, ordered, note] = await Promise.all([
    prisma.vipLessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: id } } }),
    // Neighbours in course order (published lessons only) for prev/next links + the syllabus rail.
    prisma.vipLesson.findMany({
      where: { published: true, module: { courseId: lesson.module.courseId } },
      orderBy: [{ module: { sortOrder: 'asc' } }, { module: { createdAt: 'asc' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, title: true, moduleId: true },
    }),
    access.allowed ? prisma.vipLessonNote.findUnique({ where: { userId_lessonId: { userId, lessonId: id } }, select: { body: true, updatedAt: true } }) : null,
  ])
  const i = ordered.findIndex((l) => l.id === id)
  const quiz = lesson.module.quiz && lesson.module.quiz.published && lesson.module.quiz._count.questions > 0 ? lesson.module.quiz : null
  const moduleLessons = ordered.filter((l) => l.moduleId === lesson.moduleId)
  const lastInModule = moduleLessons.length > 0 && moduleLessons[moduleLessons.length - 1].id === id
  return {
    lesson,
    ...access,
    granted,
    completed: !!done,
    prev: i > 0 ? ordered[i - 1] : null,
    next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : null,
    position: i >= 0 ? { index: i + 1, total: ordered.length } : null,
    // Resources (titles + links) only for members who may open the lesson.
    resources: access.allowed
      ? lesson.resources.map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          href: r.kind === 'FILE' && r.file ? `/api/vip/files/${r.file.id}` : r.url,
          fileName: r.file?.fileName ?? null,
          sizeBytes: r.file?.sizeBytes ?? null,
        })).filter((r) => !!r.href)
      : [],
    note: note ? { body: note.body, updatedAt: note.updatedAt.toISOString() } : null,
    moduleQuiz: quiz && lastInModule ? { id: quiz.id, title: quiz.title } : null,
  }
}

/** Remember the last lesson a member opened in a course ("resume"). */
export async function recordResume(userId: string, courseId: string, lessonId: string) {
  await prisma.vipCourseResume.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { lessonId },
    create: { userId, courseId, lessonId },
  })
}

/** "Continue learning": the most recently opened courses that aren't finished. */
export async function continueLearning(userId: string, accessTier: MembershipTier, opts: { isAdmin?: boolean; take?: number } = {}) {
  const resumes = await prisma.vipCourseResume.findMany({
    where: { userId, course: { published: true } },
    orderBy: { updatedAt: 'desc' },
    take: 6,
    select: { lessonId: true, updatedAt: true, course: { select: { id: true, slug: true, title: true, minTier: true, purchaseOnly: true } } },
  })
  if (resumes.length === 0) return []
  const courseIds = resumes.map((r) => r.course.id)
  const [lessons, granted, certs] = await Promise.all([
    prisma.vipLesson.findMany({
      where: { published: true, module: { courseId: { in: courseIds } } },
      orderBy: [{ module: { sortOrder: 'asc' } }, { module: { createdAt: 'asc' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, title: true, minTier: true, module: { select: { courseId: true } } },
    }),
    grantedCourseIds(userId, courseIds),
    prisma.vipCertificate.findMany({ where: { userId, courseId: { in: courseIds } }, select: { courseId: true } }),
  ])
  const done = new Set(
    (await prisma.vipLessonProgress.findMany({ where: { userId, lessonId: { in: lessons.map((l) => l.id) } }, select: { lessonId: true } })).map((p) => p.lessonId),
  )
  const finished = new Set(certs.map((c) => c.courseId))
  const out = []
  for (const r of resumes) {
    if (finished.has(r.course.id)) continue
    const own = lessons.filter((l) => l.module.courseId === r.course.id)
    const gate = { granted: granted.has(r.course.id), isAdmin: opts.isAdmin }
    const open = (l: (typeof own)[number]) => allowsTier(r.course, l.minTier ?? r.course.minTier, accessTier, gate)
    const last = own.find((l) => l.id === r.lessonId)
    const lesson = last && !done.has(last.id) && open(last) ? last : own.find((l) => !done.has(l.id) && open(l)) ?? (last && open(last) ? last : undefined)
    if (!lesson) continue
    out.push({
      courseSlug: r.course.slug,
      courseTitle: r.course.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      done: own.filter((l) => done.has(l.id)).length,
      total: own.length,
      at: r.updatedAt.toISOString(),
    })
    if (out.length >= (opts.take ?? 3)) break
  }
  return out
}

/** Quiz as members see it before answering: never includes the answers. */
export async function getQuizForMember(quizId: string, userId: string, accessTier: MembershipTier, opts: { isAdmin?: boolean } = {}) {
  const quiz = await prisma.vipQuiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, prompt: true, options: true } },
      module: {
        include: {
          course: true,
          lessons: { where: { published: true }, select: { id: true, minTier: true } },
        },
      },
    },
  })
  if (!quiz || !quiz.published || !quiz.module.course.published || quiz.questions.length === 0) return null
  const course = quiz.module.course
  const granted = await hasCourseGrant(userId, course.id)
  const gate = { granted, isAdmin: opts.isAdmin }
  const allowed =
    quiz.module.lessons.length === 0
      ? allowsTier(course, course.minTier, accessTier, gate)
      : quiz.module.lessons.some((l) => allowsTier(course, l.minTier ?? course.minTier, accessTier, gate))
  const attempts = await prisma.vipQuizAttempt.findMany({
    where: { userId, quizId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, scorePct: true, passed: true, createdAt: true },
  })
  return {
    id: quiz.id,
    title: quiz.title,
    intro: quiz.intro,
    passPct: quiz.passPct,
    allowed,
    course: { id: course.id, slug: course.slug, title: course.title, minTier: course.minTier },
    moduleTitle: quiz.module.title,
    questions: allowed ? quiz.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: quizOptions(q.options) })) : [],
    attempts: attempts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    passed: attempts.some((a) => a.passed),
  }
}

// ─── Events ────────────────────────────────────────────────────────────────

export const EVENT_KINDS = ['AMA', 'WORKSHOP', 'CLASS', 'OFFICE_HOURS'] as const
export type EventKind = (typeof EVENT_KINDS)[number]
export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  AMA: 'Live Q&A',
  WORKSHOP: 'Workshop',
  CLASS: 'Workout class',
  OFFICE_HOURS: 'Office hours',
}
export function eventKind(kind: string | null | undefined): EventKind {
  return (EVENT_KINDS as readonly string[]).includes(kind ?? '') ? (kind as EventKind) : 'AMA'
}

/** RSVP rows from before the waitlist existed have status null = GOING. */
export const GOING_WHERE = { OR: [{ status: 'GOING' }, { status: null }] }

type EventRow = Awaited<ReturnType<typeof prisma.vipEvent.findMany>>[number] & {
  rsvps: { status: string | null; createdAt: Date }[]
}

async function goingCounts(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, number>()
  const rows = await prisma.vipEventRsvp.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, ...GOING_WHERE }, _count: { _all: true } })
  return new Map(rows.map((r) => [r.eventId, r._count._all]))
}

async function waitlistPositions(userId: string, events: EventRow[]) {
  const out = new Map<string, number>()
  for (const e of events) {
    const mine = e.rsvps[0]
    if (mine?.status !== 'WAITLIST') continue
    const ahead = await prisma.vipEventRsvp.count({ where: { eventId: e.id, status: 'WAITLIST', createdAt: { lt: mine.createdAt } } })
    out.set(e.id, ahead + 1)
  }
  return out
}

function eventView(e: EventRow, accessTier: MembershipTier, going: number, position: number | undefined, now: Date) {
  const allowed = tierAllows(accessTier, e.minTier)
  const mine = e.rsvps[0]
  const ended = (e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3600e3)) < now
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    minTier: e.minTier,
    repeatMonthly: e.repeatMonthly,
    kind: eventKind(e.kind),
    capacity: e.capacity ?? null,
    allowed,
    ended,
    // The join link is only ever sent to members who meet the tier.
    joinUrl: allowed && !ended ? e.joinUrl : null,
    recordingUrl: allowed ? e.recordingUrl : null,
    hasRecording: !!e.recordingUrl,
    rsvpCount: going,
    spotsLeft: e.capacity ? Math.max(0, e.capacity - going) : null,
    going: !!mine && mine.status !== 'WAITLIST',
    waitlisted: mine?.status === 'WAITLIST',
    waitlistPosition: position ?? null,
  }
}

export type EventView = ReturnType<typeof eventView>

export async function listUpcomingEvents(userId: string, accessTier: MembershipTier, now = new Date()) {
  const events = await prisma.vipEvent.findMany({
    where: {
      published: true,
      cancelledAt: null,
      // still upcoming, or started within the last 3 hours (live now)
      OR: [{ startsAt: { gte: new Date(now.getTime() - 3 * 3600e3) } }, { endsAt: { gte: now } }],
    },
    orderBy: { startsAt: 'asc' },
    include: { rsvps: { where: { userId }, select: { status: true, createdAt: true } } },
    take: 50,
  })
  const [counts, positions] = await Promise.all([goingCounts(events.map((e) => e.id)), waitlistPositions(userId, events)])
  return events.map((e) => eventView(e, accessTier, counts.get(e.id) ?? 0, positions.get(e.id), now))
}

/** Every published, non-cancelled event in [from, to) — the calendar month view. */
export async function listEventsBetween(userId: string, accessTier: MembershipTier, from: Date, to: Date, now = new Date()) {
  const events = await prisma.vipEvent.findMany({
    where: { published: true, cancelledAt: null, startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: 'asc' },
    include: { rsvps: { where: { userId }, select: { status: true, createdAt: true } } },
    take: 200,
  })
  const [counts, positions] = await Promise.all([goingCounts(events.map((e) => e.id)), waitlistPositions(userId, events)])
  return events.map((e) => eventView(e, accessTier, counts.get(e.id) ?? 0, positions.get(e.id), now))
}

/** Past sessions that have a recording (newest first). */
export async function listPastRecordings(userId: string, accessTier: MembershipTier, now = new Date(), take = 12) {
  const events = await prisma.vipEvent.findMany({
    where: { published: true, cancelledAt: null, startsAt: { lt: now }, recordingUrl: { not: null } },
    orderBy: { startsAt: 'desc' },
    include: { rsvps: { where: { userId }, select: { status: true, createdAt: true } } },
    take,
  })
  return events.map((e) => eventView(e, accessTier, 0, undefined, now))
}

export async function eventAccess(eventId: string, accessTier: MembershipTier) {
  const e = await prisma.vipEvent.findUnique({ where: { id: eventId } })
  if (!e || !e.published || e.cancelledAt) return null
  return { event: e, allowed: tierAllows(accessTier, e.minTier) }
}
