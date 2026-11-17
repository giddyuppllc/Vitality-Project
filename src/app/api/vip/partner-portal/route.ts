import { NextRequest } from 'next/server'
import { z } from 'zod'
import { vipJson } from '@/lib/vip/access'
import { lookupMember, publicTxn, recentPartnerTxns, recordPurchase, redeemAtPartner, voidPartnerTxn } from '@/lib/vip/partners'
import { requirePartnerStaffApi, rewardsErrorResponse, userRateLimit } from '@/lib/vip/rewards-api'

export const dynamic = 'force-dynamic'

/**
 * Partner portal API (vitalityproject.vip/partners/portal). Staff of a partner
 * business only (VipPartnerStaff); every operation is scoped to the partner
 * the staff member works for.
 *
 *   GET                         recent transactions at my partner
 *   POST {op:'lookup'}          member by member number / QR
 *   POST {op:'purchase'}        record a purchase → points (once per receipt)
 *   POST {op:'redeem'}          spend points with the member's one-time code
 *   POST {op:'void'}            void within 24 h
 */
export async function GET(req: NextRequest) {
  const gate = await requirePartnerStaffApi(req.nextUrl.searchParams.get('partnerId'))
  if (gate.response) return gate.response
  return vipJson({ partner: { id: gate.staff.partner.id, name: gate.staff.partner.name }, txns: await recentPartnerTxns(gate.staff.partner.id) })
}

const memberNumber = z.string().trim().min(8).max(40)
const schema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('lookup'), partnerId: z.string().optional(), memberNumber }),
  z.object({
    op: z.literal('purchase'),
    partnerId: z.string().optional(),
    memberNumber,
    amountCents: z.number().int().min(1).max(10_000_000),
    receiptRef: z.string().trim().min(1).max(64),
  }),
  z.object({ op: z.literal('redeem'), partnerId: z.string().optional(), memberNumber, code: z.string().trim().min(6).max(12) }),
  z.object({ op: z.literal('void'), partnerId: z.string().optional(), txnId: z.string().min(1).max(64), reason: z.string().trim().max(300).optional() }),
])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  const gate = await requirePartnerStaffApi(parsed.success ? parsed.data.partnerId : (body as { partnerId?: string } | null)?.partnerId)
  if (gate.response) return gate.response
  if (!parsed.success) return vipJson({ error: 'Check the details and try again.' }, { status: 400 })
  const { staff } = gate
  const d = parsed.data
  const wait =
    d.op === 'redeem'
      ? userRateLimit('portal-redeem', staff.userId, 20, 10 * 60_000)
      : userRateLimit('portal', staff.userId, 120, 60_000)
  if (wait) return vipJson({ error: 'Too many requests. Wait a moment and try again.', retryAfter: wait }, { status: 429 })
  try {
    if (d.op === 'lookup') return vipJson({ ok: true, member: await lookupMember(staff, d.memberNumber) })
    if (d.op === 'purchase') {
      const r = await recordPurchase(staff, d)
      return vipJson({ ok: true, duplicate: r.duplicate, txn: publicTxn(r.txn) }, { status: r.duplicate ? 200 : 201 })
    }
    if (d.op === 'redeem') {
      const r = await redeemAtPartner(staff, d)
      return vipJson({ ok: true, points: r.points, txn: publicTxn(r.txn) }, { status: 201 })
    }
    const r = await voidPartnerTxn(staff, d)
    return vipJson({ ok: true, alreadyVoided: r.alreadyVoided, txn: publicTxn(r.txn) })
  } catch (e) {
    return rewardsErrorResponse(e)
  }
}
