import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, readBody } from '@/lib/vip/fitness/api'
import { resolveTimeZone } from '@/lib/vip/fitness/profile'
import { listHistory, startWorkout } from '@/lib/vip/fitness/workouts'

export const dynamic = 'force-dynamic'

const schema = z.object({
  programDayId: z.string().min(1).max(64).nullish(),
  title: z.string().max(160).nullish(),
  tz: z.string().max(64).optional(),
})

/** GET — the member's own finished workouts. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  return vipJson({ workouts: await listHistory(gate.viewer.userId) })
}

/** POST — start a workout (program day or freestyle). 409 + openId when one is already open. */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const body = await readBody(req, schema)
  if ('error' in body) return body.error
  try {
    await resolveTimeZone(gate.viewer.userId, body.data.tz)
    const log = await startWorkout(gate.viewer.userId, gate.viewer.accessTier, body.data)
    return vipJson({ id: log.id }, { status: 201 })
  } catch (err) {
    return fitnessError(err, 'workouts.start')
  }
}
