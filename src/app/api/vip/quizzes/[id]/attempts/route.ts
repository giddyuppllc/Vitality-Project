import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimitKey } from '@/lib/rate-limit'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { getQuizForMember } from '@/lib/vip/classroom'
import { finishCourseIfComplete, pointKeys, quizOptions, scoreQuiz } from '@/lib/vip/academy'
import { awardPoints } from '@/lib/vip/points'
import { getVipSettings } from '@/lib/vip/settings'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({
  answers: z.record(z.string().max(64), z.number().int().min(0).max(20)),
})

/**
 * POST /api/vip/quizzes/:id/attempts — submit answers. Scored on the server;
 * the correct answers and explanations come back only in this response,
 * after the member has committed. Retries are unlimited (rate-limited). A
 * pass awards the quiz's points once and may finish the course.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const v = gate.viewer
  const quiz = await getQuizForMember(id, v.userId, v.accessTier, { isAdmin: v.isAdmin })
  if (!quiz) return vipJson({ error: 'Not found' }, { status: 404 })
  if (!quiz.allowed) return vipJson({ error: 'tier_required', minTier: quiz.course.minTier }, { status: 403 })

  const limit = checkRateLimitKey(`vip:quiz:${v.userId}`, { limit: 30, windowMs: 60 * 60_000 })
  if (!limit.allowed) return vipJson({ error: 'Take a breather and try again shortly.', retryAfter: limit.retryAfter }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid answers' }, { status: 400 })

  const questions = await prisma.vipQuizQuestion.findMany({
    where: { quizId: id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, correctIndex: true, options: true, explanation: true },
  })
  const result = scoreQuiz(questions, parsed.data.answers, quiz.passPct)
  const answers: Record<string, number> = {}
  for (const r of result.results) if (r.chosen !== null) answers[r.id] = r.chosen

  const attempt = await prisma.vipQuizAttempt.create({
    data: { quizId: id, userId: v.userId, correct: result.correct, total: result.total, scorePct: result.scorePct, passed: result.passed, answers },
  })

  let pointsAwarded = 0
  let courseCompleted = false
  let certificateCode: string | null = null
  if (result.passed) {
    const pts = (await getVipSettings())['vip.points.quizPassed']
    if (pts > 0) {
      const r = await awardPoints({ userId: v.userId, points: pts, type: 'EARN_ENGAGEMENT', description: 'Quiz passed', idempotencyKey: pointKeys.quiz(id, v.userId) })
      if (!r.duplicate) pointsAwarded += r.points
    }
    const c = await finishCourseIfComplete(v.userId, quiz.course.id)
    pointsAwarded += c.points
    courseCompleted = c.completed
    certificateCode = c.certificateCode
  }

  const byId = new Map(questions.map((q) => [q.id, q]))
  return vipJson({
    attemptId: attempt.id,
    correct: result.correct,
    total: result.total,
    scorePct: result.scorePct,
    passPct: quiz.passPct,
    passed: result.passed,
    pointsAwarded,
    courseCompleted,
    certificateCode,
    results: result.results.map((r) => {
      const q = byId.get(r.id)!
      return { id: r.id, chosen: r.chosen, correct: r.correct, correctIndex: q.correctIndex, correctOption: quizOptions(q.options)[q.correctIndex] ?? null, explanation: q.explanation }
    }),
  })
}
