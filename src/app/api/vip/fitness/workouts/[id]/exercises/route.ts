import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, readBody } from '@/lib/vip/fitness/api'
import { addExercise, removeExercise } from '@/lib/vip/fitness/workouts'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }
const schema = z.object({ exerciseId: z.string().min(1).max(64) })

/** POST — add an exercise to an open workout. DELETE — drop it (and its sets). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const { id } = await params
  const body = await readBody(req, schema)
  if ('error' in body) return body.error
  try {
    const log = await addExercise(gate.viewer.userId, id, body.data.exerciseId)
    return vipJson({ ok: true, exerciseOrder: log.exerciseOrder })
  } catch (err) {
    return fitnessError(err, 'workouts.exercises.add')
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const body = await readBody(req, schema)
  if ('error' in body) return body.error
  try {
    await removeExercise(gate.viewer.userId, id, body.data.exerciseId)
    return vipJson({ ok: true })
  } catch (err) {
    return fitnessError(err, 'workouts.exercises.remove')
  }
}
