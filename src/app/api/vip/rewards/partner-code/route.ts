import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { createRedeemCode } from '@/lib/vip/partners'
import { rewardsErrorResponse, userRateLimit } from '@/lib/vip/rewards-api'

export const dynamic = 'force-dynamic'

const schema = z.object({ partnerId: z.string().min(1).max(64), points: z.number().int().min(100).max(10_000_000) })

/**
 * POST /api/vip/rewards/partner-code — the member approves spending `points`
 * at one partner: returns a 6-digit code (10 minutes, single use) to show
 * the partner's staff.
 */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const wait = userRateLimit('partner-code', gate.viewer.userId, 10, 10 * 60_000)
  if (wait) return vipJson({ error: 'Too many codes requested. Try again in a few minutes.', retryAfter: wait }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Choose at least 100 points ($1).' }, { status: 400 })
  try {
    const out = await createRedeemCode({ userId: gate.viewer.userId, ...parsed.data })
    return vipJson({ ok: true, ...out }, { status: 201 })
  } catch (e) {
    return rewardsErrorResponse(e)
  }
}
