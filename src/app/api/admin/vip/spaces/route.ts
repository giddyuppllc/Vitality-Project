import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { slugify } from '@/lib/utils'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).nullish(),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
  adminOnly: z.boolean().optional(),
})

export async function GET() {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const spaces = await prisma.vipSpace.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return NextResponse.json({ spaces })
}

/** POST /api/admin/vip/spaces — create a community space/category. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const slug = slugify(parsed.data.slug || parsed.data.name)
  if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  const exists = await prisma.vipSpace.findUnique({ where: { slug } })
  if (exists) return NextResponse.json({ error: 'A space with that slug exists' }, { status: 409 })
  const space = await prisma.vipSpace.create({
    data: {
      slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      sortOrder: parsed.data.sortOrder ?? 0,
      adminOnly: !!parsed.data.adminOnly,
    },
  })
  await logAudit({ userId: gate.userId, action: 'vip.space.create', entityType: 'VipSpace', entityId: space.id })
  return NextResponse.json({ space }, { status: 201 })
}
