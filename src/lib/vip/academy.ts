import { randomBytes } from 'node:crypto'
import { Prisma, type MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from './access'
import { awardPoints, InsufficientPointsError, spendPoints } from './points'
import { getVipSettings } from './settings'

/**
 * The Academy: access rules (tier, grants, purchase-only), completion,
 * quiz scoring, certificates and the points that go with them.
 *
 * Access to a course or lesson:
 *   admin                                  → always
 *   a VipCourseGrant for (member, course)  → always (points, purchase, admin)
 *   course.purchaseOnly                    → never otherwise
 *   else                                   → tier meets lesson.minTier ?? course.minTier
 *
 * Points (all exactly-once through lib/vip/points.ts, values in settings):
 *   lesson complete  lesson:<lessonId>:<userId>
 *   quiz passed      quiz:<quizId>:<userId>
 *   course complete  course:<courseId>:<userId>
 * Un-marking a lesson never takes points back, and re-marking never pays twice.
 */

export interface AccessViewer {
  userId: string
  accessTier: MembershipTier
  isAdmin?: boolean
}

export interface CourseAccessFields {
  id: string
  minTier: MembershipTier
  purchaseOnly: boolean | null
  priceCents: number | null
  pointsPrice: number | null
}

// Grant reads live in lib/vip/course-grants.ts (shared with rewards).
export { grantedCourseIds, hasCourseGrant } from './course-grants'
import { hasCourseGrant } from './course-grants'

/** Can this member open lessons that require `minTier` in this course? */
export function allowsTier(
  course: Pick<CourseAccessFields, 'purchaseOnly'>,
  minTier: MembershipTier,
  accessTier: MembershipTier,
  opts: { granted?: boolean; isAdmin?: boolean } = {},
): boolean {
  if (opts.isAdmin || opts.granted) return true
  if (course.purchaseOnly) return false
  return tierAllows(accessTier, minTier)
}

export function isPurchasable(course: Pick<CourseAccessFields, 'priceCents' | 'pointsPrice'>): boolean {
  return (course.priceCents ?? 0) > 0 || (course.pointsPrice ?? 0) > 0
}

// ─── Points ────────────────────────────────────────────────────────────────

export const pointKeys = {
  lesson: (lessonId: string, userId: string) => `lesson:${lessonId}:${userId}`,
  quiz: (quizId: string, userId: string) => `quiz:${quizId}:${userId}`,
  course: (courseId: string, userId: string) => `course:${courseId}:${userId}`,
  training: (courseId: string, userId: string) => `training:${courseId}:${userId}`,
}

async function award(userId: string, points: number, key: string, description: string) {
  if (!points || points <= 0) return null
  return awardPoints({ userId, points, type: 'EARN_ENGAGEMENT', description, idempotencyKey: key, source: 'vip' })
}

// ─── Completion ────────────────────────────────────────────────────────────

export interface CompletionResult {
  lessonPoints: number
  coursePoints: number
  courseCompleted: boolean
  certificateCode: string | null
}

/**
 * Mark a lesson complete (idempotent), award its points once, and finish the
 * course if this was the last step. The caller has already checked access.
 */
export async function completeLesson(userId: string, lessonId: string): Promise<CompletionResult> {
  const lesson = await prisma.vipLesson.findUniqueOrThrow({
    where: { id: lessonId },
    select: { id: true, title: true, module: { select: { courseId: true } } },
  })
  await prisma.vipLessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: {},
    create: { userId, lessonId },
  })
  const settings = await getVipSettings()
  const res = await award(userId, settings['vip.points.lessonComplete'], pointKeys.lesson(lessonId, userId), 'Lesson completed')
  const course = await finishCourseIfComplete(userId, lesson.module.courseId)
  return {
    lessonPoints: res && !res.duplicate ? res.points : 0,
    coursePoints: course.points,
    courseCompleted: course.completed,
    certificateCode: course.certificateCode,
  }
}

/** Published lessons + quizzes (with questions) that make up a course. */
async function courseRequirements(courseId: string) {
  const modules = await prisma.vipModule.findMany({
    where: { courseId },
    select: {
      lessons: { where: { published: true }, select: { id: true } },
      quiz: { select: { id: true, published: true, _count: { select: { questions: true } } } },
    },
  })
  return {
    lessonIds: modules.flatMap((m) => m.lessons.map((l) => l.id)),
    quizIds: modules.flatMap((m) => (m.quiz && m.quiz.published && m.quiz._count.questions > 0 ? [m.quiz.id] : [])),
  }
}

export async function courseCompletionState(userId: string, courseId: string) {
  const { lessonIds, quizIds } = await courseRequirements(courseId)
  const [done, passed] = await Promise.all([
    prisma.vipLessonProgress.count({ where: { userId, lessonId: { in: lessonIds } } }),
    prisma.vipQuizAttempt.findMany({ where: { userId, quizId: { in: quizIds }, passed: true }, select: { quizId: true }, distinct: ['quizId'] }),
  ])
  const total = lessonIds.length + quizIds.length
  const complete = done + passed.length
  return { total, complete, lessonsTotal: lessonIds.length, lessonsDone: done, quizzesTotal: quizIds.length, quizzesPassed: passed.length, finished: total > 0 && complete >= total }
}

export async function finishCourseIfComplete(
  userId: string,
  courseId: string,
): Promise<{ completed: boolean; points: number; certificateCode: string | null }> {
  const state = await courseCompletionState(userId, courseId)
  if (!state.finished) return { completed: false, points: 0, certificateCode: null }
  const cert = await issueCertificate(userId, courseId)
  const settings = await getVipSettings()
  const res = await award(userId, settings['vip.points.courseComplete'], pointKeys.course(courseId, userId), 'Course completed')
  return { completed: true, points: res && !res.duplicate ? res.points : 0, certificateCode: cert.code }
}

// ─── Certificates ──────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

export function newCertificateCode(): string {
  const bytes = randomBytes(10)
  let s = ''
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return `VP-${s.slice(0, 5)}-${s.slice(5, 10)}`
}

export const CERT_CODE_RE = /^VP-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/

/** One certificate per member per course (unique); a repeat returns the first. */
export async function issueCertificate(userId: string, courseId: string) {
  const existing = await prisma.vipCertificate.findUnique({ where: { userId_courseId: { userId, courseId } } })
  if (existing) return existing
  const [user, course] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, username: true, vipProfile: { select: { displayName: true } } },
    }),
    prisma.vipCourse.findUniqueOrThrow({ where: { id: courseId }, select: { title: true } }),
  ])
  const recipientName = user.name?.trim() || user.vipProfile?.displayName?.trim() || user.username || 'Member'
  for (let i = 0; i < 5; i++) {
    try {
      return await prisma.vipCertificate.create({
        data: { userId, courseId, code: newCertificateCode(), recipientName, courseTitle: course.title },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const raced = await prisma.vipCertificate.findUnique({ where: { userId_courseId: { userId, courseId } } })
        if (raced) return raced
        continue // code collision: try another
      }
      throw e
    }
  }
  throw new Error('Could not issue a certificate code')
}

function normaliseName(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
}

/**
 * Public verification. Returns ONLY non-private facts: the course, the date
 * and the code. The holder's name is never returned; a visitor who already
 * knows it can confirm it matches (`nameMatches`).
 */
export async function verifyCertificate(code: string, name?: string | null) {
  const c = code.trim().toUpperCase()
  if (!CERT_CODE_RE.test(c)) return null
  const cert = await prisma.vipCertificate.findUnique({ where: { code: c } })
  if (!cert) return null
  const n = name ? normaliseName(name) : ''
  return {
    code: cert.code,
    courseTitle: cert.courseTitle,
    issuedAt: cert.issuedAt.toISOString(),
    nameChecked: !!n,
    nameMatches: n ? normaliseName(cert.recipientName) === n : null,
  }
}

// ─── Quizzes ───────────────────────────────────────────────────────────────

export interface QuizQuestionInput {
  id: string
  correctIndex: number
  options: unknown
}

export function quizOptions(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === 'string') : []
}

/** Pure scorer. Unanswered or out-of-range answers count as wrong. */
export function scoreQuiz(
  questions: QuizQuestionInput[],
  answers: Record<string, number>,
  passPct: number,
): { correct: number; total: number; scorePct: number; passed: boolean; results: Array<{ id: string; chosen: number | null; correct: boolean }> } {
  const results = questions.map((q) => {
    const raw = answers[q.id]
    const chosen = Number.isInteger(raw) && raw >= 0 && raw < quizOptions(q.options).length ? raw : null
    return { id: q.id, chosen, correct: chosen !== null && chosen === q.correctIndex }
  })
  const correct = results.filter((r) => r.correct).length
  const total = questions.length
  const scorePct = total ? Math.round((correct / total) * 100) : 0
  return { correct, total, scorePct, passed: total > 0 && scorePct >= passPct, results }
}

// ─── Paid trainings: points ────────────────────────────────────────────────

export class TrainingNotForSaleError extends Error {}

/**
 * Buy a course with points: spend (REDEEM_REWARD, exactly once per member per
 * course) and write the grant in ONE transaction. Already granted → no spend.
 */
export async function redeemCourseWithPoints(userId: string, courseId: string): Promise<{ granted: true; spent: number; already: boolean; balance: number | null }> {
  const course = await prisma.vipCourse.findUnique({ where: { id: courseId } })
  if (!course || !course.published) throw new TrainingNotForSaleError('Not found')
  if (await hasCourseGrant(userId, courseId)) return { granted: true, spent: 0, already: true, balance: null }
  const price = course.pointsPrice ?? 0
  if (price <= 0) throw new TrainingNotForSaleError('This training is not available for points')
  const key = pointKeys.training(courseId, userId)
  try {
    const res = await prisma.$transaction(async (tx) => {
      const spend = await spendPoints({
        userId,
        points: price,
        type: 'REDEEM_REWARD',
        description: `Training: ${course.title}`,
        idempotencyKey: key,
        source: 'vip',
        tx,
      })
      await tx.vipCourseGrant.create({ data: { userId, courseId, source: 'points' } })
      return spend
    })
    return { granted: true, spent: price, already: false, balance: res.balance }
  } catch (e) {
    if (e instanceof InsufficientPointsError) throw e
    // Lost a race (same key or grant already written): the other one stands.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && (await hasCourseGrant(userId, courseId))) {
      return { granted: true, spent: 0, already: true, balance: null }
    }
    throw e
  }
}
