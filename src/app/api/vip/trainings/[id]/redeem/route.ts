import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { redeemCourseWithPoints, TrainingNotForSaleError } from '@/lib/vip/academy'
import { InsufficientPointsError } from '@/lib/vip/points'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/vip/trainings/:courseId/redeem — open a training with points.
 * Spends once per member per course (REDEEM_REWARD, idempotency key
 * training:<courseId>:<userId>) and writes the VipCourseGrant in the same
 * transaction. Already open → 200 with already: true and nothing spent.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  try {
    const r = await redeemCourseWithPoints(gate.viewer.userId, id)
    return vipJson({ ok: true, ...r })
  } catch (e) {
    if (e instanceof InsufficientPointsError) return vipJson({ error: 'You don’t have enough points for this training yet.' }, { status: 409 })
    if (e instanceof TrainingNotForSaleError) {
      return vipJson({ error: e.message === 'Not found' ? 'Not found' : 'This training isn’t available for points.' }, { status: e.message === 'Not found' ? 404 : 400 })
    }
    console.error('[vip/trainings/redeem]', e)
    return vipJson({ error: 'Something went wrong. Nothing was spent — please try again.' }, { status: 500 })
  }
}
