import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { slugify } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import { finishCourseIfComplete } from '@/lib/vip/academy'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/vip/classroom — create/update/delete courses, modules and
 * lessons, plus the Academy pieces: learning paths (tracks), module quizzes
 * and their questions, lesson resources and course grants. All content is
 * admin-entered.
 */
const tier = z.enum(['CLUB', 'PLUS', 'PREMIUM'])
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Must be an http(s) link')
  .nullish()

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('course.upsert'),
    id: z.string().max(64).optional(),
    title: z.string().trim().min(1).max(160),
    slug: z.string().trim().max(80).optional(),
    summary: z.string().trim().max(2000).nullish(),
    coverImage: optionalUrl,
    minTier: tier,
    published: z.boolean(),
    sortOrder: z.number().int().min(-1000).max(1000).optional(),
    // Academy (optional: omitted = unchanged)
    trackId: z.string().max(64).nullish(),
    level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).nullish(),
    estimatedMinutes: z.number().int().min(0).max(10_000).nullish(),
    purchaseOnly: z.boolean().optional(),
    priceCents: z.number().int().min(0).max(10_000_000).nullish(),
    pointsPrice: z.number().int().min(0).max(100_000_000).nullish(),
  }),
  z.object({ op: z.literal('course.delete'), id: z.string().max(64) }),
  z.object({
    op: z.literal('module.upsert'),
    id: z.string().max(64).optional(),
    courseId: z.string().max(64),
    title: z.string().trim().min(1).max(160),
    sortOrder: z.number().int().min(-1000).max(1000).optional(),
  }),
  z.object({ op: z.literal('module.delete'), id: z.string().max(64) }),
  z.object({
    op: z.literal('lesson.upsert'),
    id: z.string().max(64).optional(),
    moduleId: z.string().max(64),
    title: z.string().trim().min(1).max(160),
    body: z.string().max(50_000),
    videoUrl: optionalUrl,
    minTier: tier.nullable(),
    published: z.boolean(),
    sortOrder: z.number().int().min(-1000).max(1000).optional(),
    durationMinutes: z.number().int().min(0).max(1000).nullish(),
  }),
  z.object({ op: z.literal('lesson.delete'), id: z.string().max(64) }),
  z.object({
    op: z.literal('track.upsert'),
    id: z.string().max(64).optional(),
    title: z.string().trim().min(1).max(160),
    slug: z.string().trim().max(80).optional(),
    summary: z.string().trim().max(2000).nullish(),
    category: z.enum(['FOUNDATIONS', 'RESEARCH', 'HEALTH', 'FITNESS', 'LIFESTYLE']),
    published: z.boolean(),
    sortOrder: z.number().int().min(-1000).max(1000).optional(),
  }),
  z.object({ op: z.literal('track.delete'), id: z.string().max(64) }),
  z.object({
    op: z.literal('quiz.upsert'),
    moduleId: z.string().max(64),
    title: z.string().trim().min(1).max(160),
    intro: z.string().trim().max(2000).nullish(),
    passPct: z.number().int().min(1).max(100),
    published: z.boolean(),
  }),
  z.object({ op: z.literal('quiz.delete'), id: z.string().max(64) }),
  z.object({
    op: z.literal('question.upsert'),
    id: z.string().max(64).optional(),
    quizId: z.string().max(64),
    prompt: z.string().trim().min(1).max(2000),
    options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
    correctIndex: z.number().int().min(0).max(5),
    explanation: z.string().trim().max(2000).nullish(),
    sortOrder: z.number().int().min(-1000).max(1000).optional(),
  }),
  z.object({ op: z.literal('question.delete'), id: z.string().max(64) }),
  z.object({
    op: z.literal('resource.add'),
    lessonId: z.string().max(64),
    title: z.string().trim().min(1).max(160),
    fileId: z.string().max(64).nullish(),
    url: z
      .string()
      .trim()
      .max(500)
      .refine((v) => /^https:\/\//i.test(v), 'Links must be https')
      .nullish(),
    sortOrder: z.number().int().min(-1000).max(1000).optional(),
  }),
  z.object({ op: z.literal('resource.delete'), id: z.string().max(64) }),
  z.object({ op: z.literal('grant.add'), courseId: z.string().max(64), email: z.string().trim().toLowerCase().email().max(200) }),
  z.object({ op: z.literal('grant.revoke'), courseId: z.string().max(64), userId: z.string().max(64) }),
])

/** Optional field: undefined = leave as is. */
function opt<K extends string, V>(key: K, v: V | undefined): Partial<Record<K, V>> {
  return v === undefined ? {} : ({ [key]: v } as Record<K, V>)
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const d = parsed.data
  let id: string | undefined

  try {
    switch (d.op) {
      case 'course.upsert': {
        const slug = slugify(d.slug || d.title)
        const clash = await prisma.vipCourse.findUnique({ where: { slug } })
        if (clash && clash.id !== d.id) {
          return NextResponse.json({ error: 'Another course already uses that slug' }, { status: 409 })
        }
        const data = {
          title: d.title,
          slug,
          summary: d.summary || null,
          coverImage: d.coverImage || null,
          minTier: d.minTier,
          published: d.published,
          sortOrder: d.sortOrder ?? 0,
          ...opt('trackId', d.trackId === undefined ? undefined : d.trackId || null),
          ...opt('level', d.level === undefined ? undefined : d.level || null),
          ...opt('estimatedMinutes', d.estimatedMinutes === undefined ? undefined : d.estimatedMinutes || null),
          ...opt('purchaseOnly', d.purchaseOnly),
          ...opt('priceCents', d.priceCents === undefined ? undefined : d.priceCents || null),
          ...opt('pointsPrice', d.pointsPrice === undefined ? undefined : d.pointsPrice || null),
        }
        if (data.purchaseOnly && !(data.priceCents ?? 0) && !(data.pointsPrice ?? 0) && !d.id) {
          return NextResponse.json({ error: 'A purchase-only training needs a price or a points price' }, { status: 400 })
        }
        const row = d.id
          ? await prisma.vipCourse.update({ where: { id: d.id }, data })
          : await prisma.vipCourse.create({ data })
        id = row.id
        break
      }
      case 'course.delete':
        await prisma.vipCourse.delete({ where: { id: d.id } })
        id = d.id
        break
      case 'module.upsert': {
        const row = d.id
          ? await prisma.vipModule.update({ where: { id: d.id }, data: { title: d.title, sortOrder: d.sortOrder ?? 0 } })
          : await prisma.vipModule.create({
              data: { courseId: d.courseId, title: d.title, sortOrder: d.sortOrder ?? 0 },
            })
        id = row.id
        break
      }
      case 'module.delete':
        await prisma.vipModule.delete({ where: { id: d.id } })
        id = d.id
        break
      case 'lesson.upsert': {
        const data = {
          title: d.title,
          body: d.body,
          videoUrl: d.videoUrl || null,
          minTier: d.minTier,
          published: d.published,
          sortOrder: d.sortOrder ?? 0,
          ...opt('durationMinutes', d.durationMinutes === undefined ? undefined : d.durationMinutes || null),
        }
        const row = d.id
          ? await prisma.vipLesson.update({ where: { id: d.id }, data })
          : await prisma.vipLesson.create({ data: { ...data, moduleId: d.moduleId } })
        id = row.id
        break
      }
      case 'lesson.delete':
        await prisma.vipLesson.delete({ where: { id: d.id } })
        id = d.id
        break
      case 'track.upsert': {
        const slug = slugify(d.slug || d.title)
        const clash = await prisma.vipTrack.findUnique({ where: { slug } })
        if (clash && clash.id !== d.id) {
          return NextResponse.json({ error: 'Another learning path already uses that slug' }, { status: 409 })
        }
        const data = { title: d.title, slug, summary: d.summary || null, category: d.category, published: d.published, sortOrder: d.sortOrder ?? 0 }
        const row = d.id ? await prisma.vipTrack.update({ where: { id: d.id }, data }) : await prisma.vipTrack.create({ data })
        id = row.id
        break
      }
      case 'track.delete':
        await prisma.vipTrack.delete({ where: { id: d.id } })
        id = d.id
        break
      case 'quiz.upsert': {
        const data = { title: d.title, intro: d.intro || null, passPct: d.passPct, published: d.published }
        const row = await prisma.vipQuiz.upsert({ where: { moduleId: d.moduleId }, update: data, create: { ...data, moduleId: d.moduleId } })
        id = row.id
        break
      }
      case 'quiz.delete':
        await prisma.vipQuiz.delete({ where: { id: d.id } })
        id = d.id
        break
      case 'question.upsert': {
        if (d.correctIndex >= d.options.length) {
          return NextResponse.json({ error: 'Pick which option is correct' }, { status: 400 })
        }
        const data = { prompt: d.prompt, options: d.options, correctIndex: d.correctIndex, explanation: d.explanation || null, sortOrder: d.sortOrder ?? 0 }
        const row = d.id
          ? await prisma.vipQuizQuestion.update({ where: { id: d.id }, data })
          : await prisma.vipQuizQuestion.create({ data: { ...data, quizId: d.quizId } })
        id = row.id
        break
      }
      case 'question.delete':
        await prisma.vipQuizQuestion.delete({ where: { id: d.id } })
        id = d.id
        break
      case 'resource.add': {
        if (!!d.fileId === !!d.url) {
          return NextResponse.json({ error: 'Attach a file or give a link (one of the two)' }, { status: 400 })
        }
        if (d.fileId && !(await prisma.vipFile.findUnique({ where: { id: d.fileId }, select: { id: true } }))) {
          return NextResponse.json({ error: 'That upload was not found — upload it again' }, { status: 400 })
        }
        const row = await prisma.vipLessonResource.create({
          data: { lessonId: d.lessonId, title: d.title, kind: d.fileId ? 'FILE' : 'LINK', fileId: d.fileId || null, url: d.url || null, sortOrder: d.sortOrder ?? 0 },
        })
        id = row.id
        break
      }
      case 'resource.delete':
        await prisma.vipLessonResource.delete({ where: { id: d.id } })
        id = d.id
        break
      case 'grant.add': {
        const user = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } })
        if (!user) return NextResponse.json({ error: 'No account with that email' }, { status: 404 })
        await prisma.vipCourseGrant.createMany({ data: [{ userId: user.id, courseId: d.courseId, source: 'admin' }], skipDuplicates: true })
        // Already done every step before the grant? Finish (certificate + points) now.
        await finishCourseIfComplete(user.id, d.courseId).catch(() => {})
        id = d.courseId
        break
      }
      case 'grant.revoke':
        await prisma.vipCourseGrant.deleteMany({ where: { userId: d.userId, courseId: d.courseId } })
        id = d.courseId
        break
    }
  } catch (err) {
    console.error('[admin/vip/classroom]', err)
    return NextResponse.json({ error: 'Not found or failed' }, { status: 404 })
  }
  await logAudit({ userId: gate.userId, action: `vip.classroom.${d.op}`, entityId: id })
  return NextResponse.json({ ok: true, id })
}
