import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, readBody } from '@/lib/vip/fitness/api'
import { joinChallenge, leaderboard, leaveChallenge } from '@/lib/vip/fitness/challenges'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET — the leaderboard as this member may see it (hidden members left out). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const c = await prisma.vipChallenge.findUnique({ where: { id }, select: { published: true } })
  if (!c?.published) return vipJson({ error: 'Not found' }, { status: 404 })
  const rows = await leaderboard(id, { viewerId: gate.viewer.userId })
  // Members see names and scores only — never another member's id.
  return vipJson({ leaderboard: rows.map(({ userId: _u, ...r }) => r) })
}

/** POST {action: join|leave}. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const { id } = await params
  const body = await readBody(req, z.object({ action: z.enum(['join', 'leave']) }))
  if ('error' in body) return body.error
  try {
    if (body.data.action === 'join') {
      const completed = await joinChallenge(gate.viewer.userId, gate.viewer.accessTier, id)
      return vipJson({ ok: true, completed })
    }
    return vipJson({ ok: await leaveChallenge(gate.viewer.userId, id) })
  } catch (err) {
    return fitnessError(err, 'challenges')
  }
}
