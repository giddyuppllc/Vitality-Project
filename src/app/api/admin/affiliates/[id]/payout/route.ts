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

/** A rejectable condition inside the payout transaction, with an HTTP status. */
class PayoutError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'PayoutError'
  }
}

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

  // Settle in ONE serializable transaction. The old path created the payout row
  // and incremented `totalPaid` by the requested amount even when the amount was
  // smaller than the oldest commission (loop broke immediately → zero commissions
  // marked PAID) — inflating totalPaid while settling nothing, repeatable. Now we
  // (a) reject when nothing can settle, (b) increment totalPaid by what ACTUALLY
  // settled, and (c) run atomically so concurrent payouts can't double-settle.
  let result: {
    payout: { id: string }
    idsToMarkPaid: string[]
    settled: number
    approvedTotal: number
  }
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const approved = await tx.affiliateCommission.findMany({
          where: { affiliateId, status: 'APPROVED' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, amount: true },
        })
        const approvedTotal = approved.reduce((sum, c) => sum + c.amount, 0)
        if (approvedTotal === 0) {
          throw new PayoutError('No approved commissions waiting to be paid', 400)
        }

        const payoutAmount = body.amount ?? approvedTotal
        if (payoutAmount > approvedTotal) {
          throw new PayoutError(
            `Payout amount ($${(payoutAmount / 100).toFixed(2)}) exceeds approved commissions ($${(approvedTotal / 100).toFixed(2)})`,
            400,
          )
        }

        // Commissions settle whole, oldest-first, up to the payout amount.
        let remaining = payoutAmount
        const idsToMarkPaid: string[] = []
        for (const c of approved) {
          if (c.amount <= remaining) {
            idsToMarkPaid.push(c.id)
            remaining -= c.amount
          } else {
            break
          }
        }
        if (idsToMarkPaid.length === 0) {
          throw new PayoutError(
            `Payout amount ($${(payoutAmount / 100).toFixed(2)}) is smaller than the oldest approved commission ($${(approved[0].amount / 100).toFixed(2)}). Enter at least that much.`,
            400,
          )
        }
        const settled = payoutAmount - remaining // == sum of commissions marked PAID

        // Conditional on status:'APPROVED' so a concurrent payout can't
        // double-settle the same rows; the count must match what we planned.
        const marked = await tx.affiliateCommission.updateMany({
          where: { id: { in: idsToMarkPaid }, status: 'APPROVED' },
          data: { status: 'PAID' },
        })
        if (marked.count !== idsToMarkPaid.length) {
          throw new PayoutError('Commissions changed during payout — retry.', 409)
        }

        const payout = await tx.affiliatePayout.create({
          data: {
            affiliateId,
            amount: settled,
            method: body.method,
            reference: body.reference ?? null,
            notes: body.notes ?? null,
          },
        })

        // Increment totalPaid by what ACTUALLY settled, so the affiliate's "Paid"
        // total always equals the sum of PAID commissions.
        await tx.affiliate.update({
          where: { id: affiliateId },
          data: { totalPaid: { increment: settled } },
        })

        return { payout, idsToMarkPaid, settled, approvedTotal }
      },
      { isolationLevel: 'Serializable' },
    )
  } catch (e) {
    if (e instanceof PayoutError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2034') {
      return NextResponse.json(
        { error: 'Another payout for this affiliate is being processed — retry.' },
        { status: 409 },
      )
    }
    throw e
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userEmail: session.user.email ?? null,
      action: 'affiliate.payout',
      entityType: 'AffiliatePayout',
      entityId: result.payout.id,
      metadata: JSON.stringify({
        affiliateId,
        amount: result.settled,
        method: body.method,
        reference: body.reference,
        commissionIds: result.idsToMarkPaid,
      }),
    },
  })

  return NextResponse.json({
    payout: result.payout,
    commissionsMarkedPaid: result.idsToMarkPaid.length,
    settled: result.settled,
    remainingApproved: result.approvedTotal - result.settled,
  })
}
