import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { eventAccess } from '@/lib/vip/classroom'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/vip/events/:id/rsvp — I'm going. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const access = await eventAccess(id, gate.viewer.accessTier)
  if (!access) return vipJson({ error: 'Not found' }, { status: 404 })
  if (!access.allowed) return vipJson({ error: 'tier_required', minTier: access.event.minTier }, { status: 403 })
  await prisma.vipEventRsvp.upsert({
    where: { eventId_userId: { eventId: id, userId: gate.viewer.userId } },
    update: {},
    create: { eventId: id, userId: gate.viewer.userId },
  })
  const count = await prisma.vipEventRsvp.count({ where: { eventId: id } })
  return vipJson({ going: true, count })
}

/** DELETE /api/vip/events/:id/rsvp — not going any more. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  await prisma.vipEventRsvp.deleteMany({ where: { eventId: id, userId: gate.viewer.userId } })
  const count = await prisma.vipEventRsvp.count({ where: { eventId: id } })
  return vipJson({ going: false, count })
}
