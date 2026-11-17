import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, readBody } from '@/lib/vip/fitness/api'
import { resolveTimeZone } from '@/lib/vip/fitness/profile'
import { finishWorkout } from '@/lib/vip/fitness/workouts'

export const dynamic = 'force-dynamic'

/** POST — finish the workout: totals, personal records, points, program progress. Safe to repeat. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const { id } = await params
  const body = await readBody(req, z.object({ tz: z.string().max(64).optional() }).default({}))
  if ('error' in body) return body.error
  try {
    const tz = await resolveTimeZone(gate.viewer.userId, body.data.tz)
    return vipJson(await finishWorkout(gate.viewer.userId, id, tz))
  } catch (err) {
    return fitnessError(err, 'workouts.finish')
  }
}
