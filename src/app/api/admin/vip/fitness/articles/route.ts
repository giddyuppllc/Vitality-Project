import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { AdminInputError, adminError, cleanSlug, id, optionalImage, parseAdmin, tier } from '@/lib/vip/fitness/admin-api'

export const dynamic = 'force-dynamic'

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('article.upsert'),
    id: id.optional(),
    title: z.string().trim().min(1).max(160),
    slug: z.string().trim().max(80).optional(),
    summary: z.string().trim().max(1000).nullish(),
    coverImage: optionalImage,
    body: z.string().max(100_000),
    category: z.enum(['NUTRITION', 'RECOVERY', 'SLEEP', 'MINDSET', 'RECIPES']),
    minTier: tier,
    published: z.boolean(),
  }),
  z.object({ op: z.literal('article.delete'), id }),
])

/** POST /api/admin/vip/fitness/articles — lifestyle library CRUD. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const body = await parseAdmin(req, schema)
  if ('error' in body) return body.error
  const d = body.data
  let entityId: string | undefined
  try {
    if (d.op === 'article.upsert') {
      const slug = cleanSlug(d.slug, d.title)
      const clash = await prisma.vipArticle.findUnique({ where: { slug } })
      if (clash && clash.id !== d.id) throw new AdminInputError('Another article already uses that slug', 409)
      const prev = d.id ? await prisma.vipArticle.findUnique({ where: { id: d.id }, select: { publishedAt: true } }) : null
      const data = {
        title: d.title,
        slug,
        summary: d.summary || null,
        coverImage: d.coverImage || null,
        body: d.body,
        category: d.category,
        minTier: d.minTier,
        published: d.published,
        // First publication date sticks; unpublishing keeps it.
        publishedAt: prev?.publishedAt ?? (d.published ? new Date() : null),
      }
      entityId = (d.id ? await prisma.vipArticle.update({ where: { id: d.id }, data }) : await prisma.vipArticle.create({ data })).id
    } else {
      await prisma.vipArticle.delete({ where: { id: d.id } })
      entityId = d.id
    }
  } catch (err) {
    return adminError(err, 'articles')
  }
  await logAudit({ userId: gate.userId, action: `vip.fitness.${d.op}`, entityType: 'VipArticle', entityId })
  return NextResponse.json({ ok: true, id: entityId })
}
