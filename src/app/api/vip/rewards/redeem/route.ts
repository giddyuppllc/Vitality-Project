import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { redeemReward } from '@/lib/vip/catalog'
import { rewardsErrorResponse, userRateLimit } from '@/lib/vip/rewards-api'

export const dynamic = 'force-dynamic'

const text = (max: number) => z.string().trim().min(1).max(max)
const schema = z.object({
  itemId: z.string().min(1).max(64),
  optionId: z.string().min(1).max(64).optional().nullable(),
  // One per press of "Redeem": a repeat with the same key is the same redemption.
  clickKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  memberNote: z.string().trim().max(1000).optional().nullable(),
  shipping: z
    .object({
      name: text(120),
      line1: text(200),
      line2: z.string().trim().max(200).optional(),
      city: text(100),
      state: text(60),
      zip: text(20),
      country: z.string().trim().min(2).max(60).default('US'),
      phone: z.string().trim().max(40).optional(),
    })
    .optional()
    .nullable(),
})

/** POST /api/vip/rewards/redeem — spend points on a catalog reward. */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const wait = userRateLimit('redeem', gate.viewer.userId, 20, 60_000)
  if (wait) return vipJson({ error: 'Too many requests. Try again shortly.', retryAfter: wait }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Check the form and try again.' }, { status: 400 })
  try {
    const { redemption, duplicate } = await redeemReward({
      userId: gate.viewer.userId,
      accessTier: gate.viewer.accessTier,
      itemId: parsed.data.itemId,
      optionId: parsed.data.optionId ?? null,
      clickKey: parsed.data.clickKey,
      memberNote: parsed.data.memberNote ?? null,
      shipping: parsed.data.shipping ?? null,
    })
    return vipJson(
      { ok: true, duplicate, redemption: { id: redemption.id, status: redemption.status, kind: redemption.kind, pointsSpent: redemption.pointsSpent } },
      { status: duplicate ? 200 : 201 },
    )
  } catch (e) {
    return rewardsErrorResponse(e)
  }
}
