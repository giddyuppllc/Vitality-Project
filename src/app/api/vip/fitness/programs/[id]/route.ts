import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, readBody } from '@/lib/vip/fitness/api'
import { completeRestDay, enroll, pauseProgram } from '@/lib/vip/fitness/programs'

export const dynamic = 'force-dynamic'

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('enroll') }),
  z.object({ action: z.literal('restart') }),
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('rest-day'), dayId: z.string().min(1).max(64) }),
])

/** POST /api/vip/fitness/programs/:id — enroll / restart / pause, or mark a rest day done. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const { id } = await params
  const body = await readBody(req, schema)
  if ('error' in body) return body.error
  const { userId, accessTier } = gate.viewer
  try {
    switch (body.data.action) {
      case 'enroll':
      case 'restart': {
        const e = await enroll(userId, id, accessTier, { restart: body.data.action === 'restart' })
        return vipJson({ ok: true, enrollmentId: e.id, status: e.status })
      }
      case 'pause':
        return vipJson({ ok: await pauseProgram(userId, id) })
      case 'rest-day': {
        const r = await completeRestDay(userId, id, body.data.dayId, accessTier)
        return vipJson({ ok: true, ...r })
      }
    }
  } catch (err) {
    return fitnessError(err, 'programs')
  }
}
