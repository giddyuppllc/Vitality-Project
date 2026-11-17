import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, readBody } from '@/lib/vip/fitness/api'
import { deleteWorkout, getWorkoutForLogger, updateWorkoutMeta } from '@/lib/vip/fitness/workouts'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET — one of the member's OWN workouts (someone else's id is a 404). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  try {
    return vipJson(await getWorkoutForLogger(gate.viewer.userId, id))
  } catch (err) {
    return fitnessError(err, 'workouts.get')
  }
}

const patch = z.object({ title: z.string().max(160).optional(), notes: z.string().max(2000).nullish() })

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const { id } = await params
  const body = await readBody(req, patch)
  if ('error' in body) return body.error
  try {
    const log = await updateWorkoutMeta(gate.viewer.userId, id, body.data)
    return vipJson({ ok: true, title: log.title, notes: log.notes })
  } catch (err) {
    return fitnessError(err, 'workouts.patch')
  }
}

/** DELETE — discard an open workout, or remove a finished one from history. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  try {
    await deleteWorkout(gate.viewer.userId, id)
    return vipJson({ ok: true })
  } catch (err) {
    return fitnessError(err, 'workouts.delete')
  }
}
