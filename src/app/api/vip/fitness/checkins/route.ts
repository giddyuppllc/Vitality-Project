import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, num, readBody, unitsSchema } from '@/lib/vip/fitness/api'
import { resolveTimeZone, todayIn } from '@/lib/vip/fitness/profile'
import { saveCheckin, streakInfo } from '@/lib/vip/fitness/health'
import { toMl } from '@/lib/vip/fitness/units'

export const dynamic = 'force-dynamic'

const schema = z.object({
  day: z.enum(['today', 'yesterday']).default('today'),
  tz: z.string().max(64).optional(),
  units: unitsSchema,
  // In the member's units (oz or ml); stored as ml.
  water: num(20_000),
  sleepHours: num(24),
  steps: num(200_000),
  mood: z.number().int().min(1).max(5).nullish(),
  energy: z.number().int().min(1).max(5).nullish(),
  workoutDone: z.boolean().optional(),
  notes: z.string().max(1000).nullish(),
})

/** PUT /api/vip/fitness/checkins — save today's (or yesterday's) private check-in. */
export async function PUT(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const body = await readBody(req, schema)
  if ('error' in body) return body.error
  const d = body.data
  try {
    const tz = await resolveTimeZone(gate.viewer.userId, d.tz)
    const r = await saveCheckin(gate.viewer.userId, tz, d.day, {
      waterMl: d.water != null ? toMl(d.water, d.units) : null,
      sleepHours: d.sleepHours,
      steps: d.steps,
      mood: d.mood,
      energy: d.energy,
      workoutDone: d.workoutDone,
      notes: d.notes,
    })
    return vipJson(r)
  } catch (err) {
    return fitnessError(err, 'checkins')
  }
}

/** GET — the member's own streak. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const tz = await resolveTimeZone(gate.viewer.userId, undefined)
  return vipJson(await streakInfo(gate.viewer.userId, todayIn(tz)))
}
