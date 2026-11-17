import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { zodMessage } from '@/lib/zod-message'

export const dynamic = 'force-dynamic'

const schema = z.object({ action: z.enum(['approve', 'cancel']) })

/**
 * PATCH /api/admin/affiliates/commissions/[id]  { action: 'approve' | 'cancel' }
 *
 * Commissions are created PENDING and the payout ("Mark paid") only settles
 * APPROVED ones — but nothing ever approved a commission, so "Owed" was
 * always $0 and payouts were impossible. This is the missing admin step.
 *
 * approve: PENDING -> APPROVED, only when the order is fully PAID (not
 *          unpaid, refunded or partially refunded).
 * cancel:  PENDING/APPROVED -> CANCELLED; takes the amount back out of the
 *          affiliate's lifetime "earned" total. PAID can't be cancelled here.
 * Conditional updates, so a double click can't apply twice.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let action: 'approve' | 'cancel'
  try {
    ;({ action } = schema.parse(await req.json()))
  } catch (err) {
    return NextResponse.json({ error: err instanceof z.ZodError ? zodMessage(err) : 'Invalid request' }, { status: 400 })
  }

  const c = await prisma.affiliateCommission.findUnique({ where: { id } })
  if (!c) return NextResponse.json({ error: 'Commission not found' }, { status: 404 })

  if (action === 'approve') {
    if (c.status !== 'PENDING') {
      return NextResponse.json({ error: `Only pending commissions can be approved (this one is ${c.status}).` }, { status: 409 })
    }
    const order = await prisma.order.findUnique({ where: { id: c.orderId }, select: { paymentStatus: true, orderNumber: true } })
    if (!order || order.paymentStatus !== 'PAID') {
      return NextResponse.json(
        { error: `Order ${order?.orderNumber ?? ''} is ${order?.paymentStatus ?? 'missing'} — only commissions on paid orders can be approved.`.replace('  ', ' ') },
        { status: 409 },
      )
    }
    const r = await prisma.affiliateCommission.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED' } })
    if (r.count === 0) return NextResponse.json({ error: 'Already changed — refresh the page.' }, { status: 409 })
  } else {
    if (c.status !== 'PENDING' && c.status !== 'APPROVED') {
      return NextResponse.json({ error: `A ${c.status} commission can't be cancelled.` }, { status: 409 })
    }
    const done = await prisma.$transaction(async (tx) => {
      const r = await tx.affiliateCommission.updateMany({
        where: { id, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'CANCELLED' },
      })
      if (r.count === 0) return false
      await tx.affiliate.update({ where: { id: c.affiliateId }, data: { totalEarned: { decrement: c.amount } } })
      return true
    })
    if (!done) return NextResponse.json({ error: 'Already changed — refresh the page.' }, { status: 409 })
  }

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: action === 'approve' ? 'affiliate.commission.approve' : 'affiliate.commission.cancel',
    entityType: 'AffiliateCommission',
    entityId: id,
    metadata: { affiliateId: c.affiliateId, orderId: c.orderId, amount: c.amount, from: c.status },
  })
  return NextResponse.json({ ok: true, status: action === 'approve' ? 'APPROVED' : 'CANCELLED' })
}
