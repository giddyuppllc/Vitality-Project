import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'

export const dynamic = 'force-dynamic'

const schema = z.object({ hideFromLeaderboards: z.boolean() })

/** GET /api/vip/rewards/prefs — the member's rewards preferences. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const p = await prisma.vipProfile.findUnique({ where: { userId: gate.viewer.userId }, select: { hideFromLeaderboards: true } })
  return vipJson({ hideFromLeaderboards: p?.hideFromLeaderboards ?? false })
}

/** PATCH /api/vip/rewards/prefs — {hideFromLeaderboards} ("hide me from leaderboards"). */
export async function PATCH(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid preference' }, { status: 400 })
  await prisma.vipProfile.upsert({
    where: { userId: gate.viewer.userId },
    update: { hideFromLeaderboards: parsed.data.hideFromLeaderboards },
    create: { userId: gate.viewer.userId, hideFromLeaderboards: parsed.data.hideFromLeaderboards },
  })
  return vipJson({ ok: true, hideFromLeaderboards: parsed.data.hideFromLeaderboards })
}
