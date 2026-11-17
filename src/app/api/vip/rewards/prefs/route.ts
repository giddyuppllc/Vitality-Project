import { NextRequest } from 'next/server'
import { z } from 'zod'
import { isHiddenFromLeaderboards, setHiddenFromLeaderboards } from '@/lib/vip/leaderboards'
import { requireVipApi, vipJson } from '@/lib/vip/access'

export const dynamic = 'force-dynamic'

const schema = z.object({ hideFromLeaderboards: z.boolean() })

/** GET /api/vip/rewards/prefs — the member's rewards preferences. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  return vipJson({ hideFromLeaderboards: await isHiddenFromLeaderboards(gate.viewer.userId) })
}

/** PATCH /api/vip/rewards/prefs — {hideFromLeaderboards}: the ONE "hide me from leaderboards" switch (lib/vip/leaderboards.ts). */
export async function PATCH(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid preference' }, { status: 400 })
  await setHiddenFromLeaderboards(gate.viewer.userId, parsed.data.hideFromLeaderboards)
  return vipJson({ ok: true, hideFromLeaderboards: parsed.data.hideFromLeaderboards })
}
