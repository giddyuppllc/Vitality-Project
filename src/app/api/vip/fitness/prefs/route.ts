import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessRateLimit, readBody } from '@/lib/vip/fitness/api'
import { getFitnessPrefs, updateFitnessPrefs } from '@/lib/vip/fitness/profile'

export const dynamic = 'force-dynamic'

const schema = z.object({
  units: z.enum(['IMPERIAL', 'METRIC']).optional(),
  hideFromLeaderboards: z.boolean().optional(),
  tz: z.string().max(64).optional(),
})

/** GET/PATCH /api/vip/fitness/prefs — the member's own units, time zone and leaderboard visibility. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  return vipJson(await getFitnessPrefs(gate.viewer.userId))
}

export async function PATCH(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const body = await readBody(req, schema)
  if ('error' in body) return body.error
  await updateFitnessPrefs(gate.viewer.userId, { units: body.data.units, hideFromLeaderboards: body.data.hideFromLeaderboards, timeZone: body.data.tz })
  return vipJson(await getFitnessPrefs(gate.viewer.userId))
}
