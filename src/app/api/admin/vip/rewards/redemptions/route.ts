import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { approveRedemption, cancelRedemption, fulfilRedemption } from '@/lib/vip/catalog'
import { rewardsErrorResponse } from '@/lib/vip/rewards-api'

export const dynamic = 'force-dynamic'

/** GET /api/admin/vip/rewards/redemptions?status= — the redemption queue. */
export async function GET(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const status = req.nextUrl.searchParams.get('status')
  const valid = ['REQUESTED', 'APPROVED', 'FULFILLED', 'CANCELLED'] as const
  const where = valid.includes(status as (typeof valid)[number]) ? { status: status as (typeof valid)[number] } : {}
  const rows = await prisma.vipRedemption.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 })
  return NextResponse.json({ redemptions: rows })
}

const schema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('approve'), id: z.string().min(1), note: z.string().trim().max(1000).optional() }),
  z.object({
    op: z.literal('fulfil'),
    id: z.string().min(1),
    trackingNumber: z.string().trim().max(120).optional(),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ op: z.literal('cancel'), id: z.string().min(1), reason: z.string().trim().max(1000).optional() }),
])

/** POST — approve / fulfil / cancel (cancel returns the points exactly once). */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const d = parsed.data
  try {
    if (d.op === 'approve') await approveRedemption(d.id, gate.userId, d.note)
    else if (d.op === 'fulfil') await fulfilRedemption(d.id, gate.userId, { trackingNumber: d.trackingNumber, note: d.note })
    else {
      const r = await cancelRedemption({ id: d.id, by: 'admin', actorUserId: gate.userId, reason: d.reason })
      return NextResponse.json({ ok: true, refunded: r.refunded, alreadyCancelled: r.alreadyCancelled })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return rewardsErrorResponse(e, true)
  }
}
