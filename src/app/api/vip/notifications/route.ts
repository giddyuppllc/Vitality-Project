import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'

export const dynamic = 'force-dynamic'

/** GET /api/vip/notifications — the viewer's latest in-app notifications. */
export async function GET() {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const [items, unread] = await Promise.all([
    prisma.vipNotification.findMany({
      where: { userId: gate.viewer.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.vipNotification.count({ where: { userId: gate.viewer.userId, readAt: null } }),
  ])
  return vipJson({ items, unread })
}

const schema = z.object({ ids: z.array(z.string().max(64)).max(100).optional(), all: z.boolean().optional() })

/** POST /api/vip/notifications {ids?|all} — mark as read. */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid request' }, { status: 400 })
  const where = parsed.data.all
    ? { userId: gate.viewer.userId, readAt: null }
    : { userId: gate.viewer.userId, id: { in: parsed.data.ids ?? [] } }
  const r = await prisma.vipNotification.updateMany({ where, data: { readAt: new Date() } })
  return vipJson({ ok: true, updated: r.count })
}
