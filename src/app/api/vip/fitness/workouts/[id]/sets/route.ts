import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, readBody, setSchema } from '@/lib/vip/fitness/api'
import { toKg } from '@/lib/vip/fitness/units'
import { addSet } from '@/lib/vip/fitness/workouts'

export const dynamic = 'force-dynamic'

/** POST — log a set (weight in the member's units; stored as kg). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const { id } = await params
  const body = await readBody(req, setSchema.extend({ exerciseId: z.string().min(1).max(64) }))
  if ('error' in body) return body.error
  const d = body.data
  try {
    const set = await addSet(gate.viewer.userId, id, d.exerciseId, {
      weightKg: d.weight != null ? toKg(d.weight, d.units) : null,
      reps: d.reps,
      durationSec: d.durationSec,
      rpe: d.rpe,
    })
    return vipJson({ set }, { status: 201 })
  } catch (err) {
    return fitnessError(err, 'sets.add')
  }
}
