import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { LIBRARY_CATEGORY_KEYS, LIBRARY_KINDS } from '@/lib/vip/library'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('upsert'),
    id: z.string().max(64).optional(),
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().max(2000).nullish(),
    category: z.enum(LIBRARY_CATEGORY_KEYS),
    kind: z.enum(LIBRARY_KINDS),
    url: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https:\/\//i.test(v), 'Links must be https')
      .nullish(),
    fileId: z.string().max(64).nullish(),
    minTier: z.enum(['CLUB', 'PLUS', 'PREMIUM']),
    published: z.boolean(),
    sortOrder: z.number().int().min(-1000).max(1000).optional(),
  }),
  z.object({ op: z.literal('delete'), id: z.string().max(64) }),
])

/** POST /api/admin/vip/library — create/update/delete a Library item. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const d = parsed.data
  let id: string
  try {
    if (d.op === 'delete') {
      await prisma.vipResource.delete({ where: { id: d.id } })
      id = d.id
    } else {
      const url = d.url || null
      const fileId = d.fileId || null
      if (!url && !fileId) return NextResponse.json({ error: 'Attach a file or give a link' }, { status: 400 })
      if (fileId && !(await prisma.vipFile.findUnique({ where: { id: fileId }, select: { id: true } }))) {
        return NextResponse.json({ error: 'That upload was not found — upload it again' }, { status: 400 })
      }
      const data = {
        title: d.title,
        summary: d.summary || null,
        category: d.category,
        kind: d.kind,
        url: fileId ? null : url,
        fileId,
        minTier: d.minTier,
        published: d.published,
        sortOrder: d.sortOrder ?? 0,
      }
      const row = d.id ? await prisma.vipResource.update({ where: { id: d.id }, data }) : await prisma.vipResource.create({ data })
      id = row.id
    }
  } catch (err) {
    console.error('[admin/vip/library]', err)
    return NextResponse.json({ error: 'Not found or failed' }, { status: 404 })
  }
  await logAudit({ userId: gate.userId, action: `vip.library.${d.op}`, entityType: 'VipResource', entityId: id })
  return NextResponse.json({ ok: true, id })
}
