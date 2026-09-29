import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { slugify } from '@/lib/utils'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/vip/classroom — create/update/delete courses, modules and
 * lessons. All content is admin-entered; nothing is seeded.
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
  }),
  z.object({ op: z.literal('lesson.delete'), id: z.string().max(64) }),
])

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
    }
  } catch (err) {
    console.error('[admin/vip/classroom]', err)
    return NextResponse.json({ error: 'Not found or failed' }, { status: 404 })
  }
  await logAudit({ userId: gate.userId, action: `vip.classroom.${d.op}`, entityId: id })
  return NextResponse.json({ ok: true, id })
}
