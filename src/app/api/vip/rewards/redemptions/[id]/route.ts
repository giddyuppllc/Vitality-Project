import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { cancelRedemption } from '@/lib/vip/catalog'
import { rewardsErrorResponse } from '@/lib/vip/rewards-api'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** DELETE /api/vip/rewards/redemptions/:id — cancel your own request while it is still REQUESTED; points come back. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  try {
    const r = await cancelRedemption({ id, by: 'member', actorUserId: gate.viewer.userId })
    return vipJson({ ok: true, status: r.redemption.status, refunded: r.refunded, alreadyCancelled: r.alreadyCancelled })
  } catch (e) {
    return rewardsErrorResponse(e)
  }
}
