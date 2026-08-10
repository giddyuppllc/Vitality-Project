import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { grantStoreCredit, processRefund } from '@/lib/store-credit'
import { sendEmail } from '@/lib/email'
import { orderRefunded } from '@/lib/email-templates'
import { z } from 'zod'

const refundSchema = z.object({
  amount: z.number().int().min(1), // cents
  reason: z.string().min(1).max(500),
  refundMethod: z.enum(['original', 'store_credit']),
})

/** Thrown inside the refund transaction when the cumulative cap would be exceeded. */
class RefundCapError extends Error {
  constructor(public readonly refundable: number) {
    super('refund cap exceeded')
    this.name = 'RefundCapError'
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { amount, reason, refundMethod } = refundSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
      },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Validate refund-method preconditions BEFORE creating the canonical Refund
    // row, so a rejected request never leaves an orphan PENDING refund (which
    // would inflate the /admin P&L and shrink the future refundable cap).
    if (refundMethod === 'store_credit' && !order.userId) {
      return NextResponse.json(
        { error: 'Cannot issue store credit for a guest order' },
        { status: 400 },
      )
    }

    // Re-check the cumulative-refund cap and create the canonical PENDING Refund
    // row inside a SERIALIZABLE transaction. The old path summed existing
    // refunds, checked the cap, then created the row as separate statements — so
    // two simultaneous submits could both read the same total, both pass the cap,
    // and both refund (double-refund). Serializable makes the second overlapping
    // transaction fail (P2034) instead of over-refunding. The cap ensures we
    // never refund more than the customer paid.
    let refundRow: { id: string }
    let alreadyRefunded = 0
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const prior = await tx.refund.findMany({
            where: { orderId: order.id, status: { not: 'FAILED' } },
            select: { amount: true },
          })
          const already = prior.reduce((sum, r) => sum + r.amount, 0)
          const refundable = order.total - already
          if (amount > refundable) throw new RefundCapError(refundable)
          const row = await tx.refund.create({
            data: {
              orderId: order.id,
              amount,
              method: refundMethod === 'store_credit' ? 'STORE_CREDIT' : 'CASH',
              reason,
              status: 'PENDING',
              createdById: session.user.id,
            },
          })
          return { row, already }
        },
        { isolationLevel: 'Serializable' },
      )
      refundRow = result.row
      alreadyRefunded = result.already
    } catch (e) {
      if (e instanceof RefundCapError) {
        return NextResponse.json(
          { error: `Refund amount exceeds remaining refundable balance ($${(e.refundable / 100).toFixed(2)})` },
          { status: 400 },
        )
      }
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2034') {
        return NextResponse.json(
          { error: 'Another refund for this order is being processed — try again in a moment.' },
          { status: 409 },
        )
      }
      throw e
    }

    // Issue the refund
    let refundRef: string | null = null

    if (refundMethod === 'store_credit') {
      if (!order.userId) {
        return NextResponse.json(
          { error: 'Cannot issue store credit for a guest order' },
          { status: 400 }
        )
      }
      await grantStoreCredit({
        userId: order.userId,
        amount,
        type: 'REFUND',
        description: `Refund for order ${order.orderNumber}: ${reason}`,
        orderId: order.id,
      })
      refundRef = `store_credit:${order.id}`
    } else {
      // original payment method — stubbed until Chase integration lands
      const result = await processRefund({
        paymentId: order.paymentId ?? '',
        amount,
        reason,
      })
      if (!result.success) {
        // Mark Refund row FAILED so the /admin/orders/[id] timeline shows
        // the attempt + reason. P&L excludes FAILED rows.
        await prisma.refund.update({
          where: { id: refundRow.id },
          data: { status: 'FAILED', reason: `${reason}\n[error: ${result.error ?? 'unknown'}]` },
        })
        return NextResponse.json(
          { error: result.error ?? 'Payment processor refund failed' },
          { status: 502 }
        )
      }
      refundRef = result.refundId ?? null
    }

    // Mark Refund row PROCESSED with the external reference.
    await prisma.refund.update({
      where: { id: refundRow.id },
      data: {
        status: 'PROCESSED',
        externalRef: refundRef,
        processedAt: new Date(),
      },
    })

    // Update order payment status
    const newTotalRefunded = alreadyRefunded + amount
    const fullyRefunded = newTotalRefunded >= order.total
    const nextPaymentStatus = fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
    const nextOrderStatus = fullyRefunded ? 'REFUNDED' : order.status

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: nextPaymentStatus,
        status: nextOrderStatus,
        notes: order.notes
          ? `${order.notes}\n\n[Refund ${amount / 100} via ${refundMethod}] ${reason}`
          : `[Refund ${amount / 100} via ${refundMethod}] ${reason}`,
      },
    })

    // Audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email ?? null,
        action: 'order.refund',
        entityType: 'Order',
        entityId: order.id,
        metadata: JSON.stringify({
          amount,
          reason,
          refundMethod,
          refundRef,
          fullyRefunded,
        }),
      },
    })

    // Notify customer
    void (async () => {
      try {
        const tpl = orderRefunded({
          orderNumber: order.orderNumber,
          customerName: order.user?.name ?? 'there',
          amount,
        })
        await sendEmail({
          to: order.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        })
      } catch (err) {
        console.error('Refund email failed:', err)
      }
    })()

    return NextResponse.json({
      ok: true,
      amount,
      refundMethod,
      refundRef,
      order: updated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Refund error:', error)
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
  }
}
