import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'

export const dynamic = 'force-dynamic'

/** DELETE /api/vip/comments/:id — the author removes their own comment. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const c = await prisma.vipComment.findUnique({ where: { id }, select: { authorId: true } })
  if (!c) return vipJson({ error: 'Not found' }, { status: 404 })
  if (c.authorId !== gate.viewer.userId) return vipJson({ error: 'Forbidden' }, { status: 403 })
  await prisma.vipComment.delete({ where: { id } })
  return vipJson({ ok: true })
}
