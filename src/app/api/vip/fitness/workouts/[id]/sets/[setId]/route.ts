import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, readBody, setSchema } from '@/lib/vip/fitness/api'
import { toKg } from '@/lib/vip/fitness/units'
import { deleteSet, updateSet } from '@/lib/vip/fitness/workouts'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; setId: string }> }

/** PATCH — correct a logged set. DELETE — remove it. Open workouts only, own sets only. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const { id, setId } = await params
  const body = await readBody(req, setSchema.partial().extend({ units: setSchema.shape.units }))
  if ('error' in body) return body.error
  const d = body.data
  try {
    const set = await updateSet(gate.viewer.userId, id, setId, {
      weightKg: d.weight === undefined ? undefined : d.weight === null ? null : toKg(d.weight, d.units),
      reps: d.reps,
      durationSec: d.durationSec,
      rpe: d.rpe,
    })
    return vipJson({ set })
  } catch (err) {
    return fitnessError(err, 'sets.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id, setId } = await params
  try {
    await deleteSet(gate.viewer.userId, id, setId)
    return vipJson({ ok: true })
  } catch (err) {
    return fitnessError(err, 'sets.delete')
  }
}
