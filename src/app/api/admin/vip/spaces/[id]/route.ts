import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(500).nullish(),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
  adminOnly: z.boolean().optional(),
  archived: z.boolean().optional(),
})

/** PATCH /api/admin/vip/spaces/:id — rename, reorder, archive/unarchive. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const d = parsed.data
  const space = await prisma.vipSpace.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      ...(d.adminOnly !== undefined ? { adminOnly: d.adminOnly } : {}),
      ...(d.archived !== undefined ? { archived: d.archived } : {}),
    },
  })
  await logAudit({ userId: gate.userId, action: 'vip.space.update', entityType: 'VipSpace', entityId: id, metadata: d })
  return NextResponse.json({ space })
}
