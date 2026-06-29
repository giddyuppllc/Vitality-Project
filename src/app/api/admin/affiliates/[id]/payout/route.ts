import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  /** Cents — what we're recording as paid out. Defaults to "all approved unpaid commissions". */
  amount: z.number().int().positive().optional(),
  method: z.enum(['paypal', 'wire', 'check', 'manual']).default('paypal'),
  reference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
})

/**
 * POST /api/admin/affiliates/[id]/payout
 *
 * Records a payout for an affiliate. The flow:
 *   1. Sums all APPROVED (unpaid) commissions for this affiliate.
 *   2. Defaults the payout amount to that sum unless body.amount is set.
 *   3. Creates an AffiliatePayout row.
 *   4. Marks the matching AffiliateCommission rows status=PAID up to the
 *      payout amount (oldest first).
 *
 * Caller can override `amount` to record a partial payout — remaining
 * approved commissions stay at APPROVED for the next batch.
 *
 * Audit-logged.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: affiliateId } = await params
  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.issues : 'Invalid body' },
      { status: 400 },
    )
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true },
  })
  if (!affiliate) {
    return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
  }

  // Pull all approved unpaid commissions, oldest first — that's the queue
  // we're paying out. (PENDING is what's recorded but not yet reviewed;
  // PAID is already settled.)
  const approved = await prisma.affiliateCommission.findMany({
    where: { affiliateId, status: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, amount: true },
  })
  const approvedTotal = approved.reduce((sum, c) => sum + c.amount, 0)
  if (approvedTotal === 0) {
    return NextResponse.json(
      { error: 'No approved commissions waiting to be paid' },
      { status: 400 },
    )
  }

  const payoutAmount = body.amount ?? approvedTotal
  if (payoutAmount > approvedTotal) {
    return NextResponse.json(
      {
        error: `Payout amount ($${(payoutAmount / 100).toFixed(2)}) exceeds approved commissions ($${(approvedTotal / 100).toFixed(2)})`,
      },
      { status: 400 },
    )
  }

  // Walk approved commissions oldest-first, marking PAID until we cover
  // the payout amount. Last commission may need a split (we keep the row
  // and just mark it paid — partial pay-outs are tracked on the Payout
  // row, not the commission rows; commissions are PAID/UNPAID booleans).
  const payout = await prisma.affiliatePayout.create({
    data: {
      affiliateId,
      amount: payoutAmount,
      method: body.method,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
    },
  })

  let remaining = payoutAmount
  const idsToMarkPaid: string[] = []
  for (const c of approved) {
    if (remaining <= 0) break
    if (c.amount <= remaining) {
      idsToMarkPaid.push(c.id)
      remaining -= c.amount
    } else {
      // Partial — leave this commission APPROVED for next payout.
      break
    }
  }
  if (idsToMarkPaid.length > 0) {
    await prisma.affiliateCommission.updateMany({
      where: { id: { in: idsToMarkPaid } },
      data: { status: 'PAID' },
    })
  }

  // Reflect the payout in the affiliate's running total so the admin "Paid"
  // column and /api/affiliate/stats stop showing $0.00 after real payouts.
  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { totalPaid: { increment: payoutAmount } },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userEmail: session.user.email ?? null,
      action: 'affiliate.payout',
      entityType: 'AffiliatePayout',
      entityId: payout.id,
      metadata: JSON.stringify({
        affiliateId,
        amount: payoutAmount,
        method: body.method,
        reference: body.reference,
        commissionIds: idsToMarkPaid,
        leftover: remaining,
      }),
    },
  })

  return NextResponse.json({
    payout,
    commissionsMarkedPaid: idsToMarkPaid.length,
    remainingApproved: approvedTotal - payoutAmount,
  })
}
