import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  orderShipped,
  orderDelivered,
  orderRefunded,
} from '@/lib/email-templates'
import { logAudit } from '@/lib/audit'
import { createAdminNotification } from '@/lib/notifications'
import { z } from 'zod'

const LOW_STOCK_THRESHOLD = 5

const updateSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED']).optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  notes: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const data = updateSchema.parse(await req.json())

    // Snapshot the order BEFORE update so we can detect status transitions
    const prev = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
      },
    })
    if (!prev) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Payment confirmation now goes through the canonical /mark-paid pipeline
    // (the order-detail button uses it). This branch only fires on a genuine
    // UNPAID→PAID transition so re-saving an already-paid order can't double-
    // decrement inventory or re-credit commission.
    if (data.paymentStatus === 'PAID' && prev.paymentStatus !== 'PAID') {
      const order = await prisma.order.findUnique({
        where: { id: id },
        include: { items: true },
      })
      if (order?.affiliateId) {
        const affiliate = await prisma.affiliate.findUnique({ where: { id: order.affiliateId } })
        if (affiliate) {
          // Gross product value (subtotal), not post-discount total — see
          // mark-paid route. Idempotent: exactly one commission per
          // (affiliate, order) so re-saving a paid order can't double-pay
          // (the old upsert keyed on a synthetic id that never matched the
          // real cuid, so it created a new row + double-incremented every time).
          const commission = Math.round(order.subtotal * affiliate.commissionRate)
          const existing = await prisma.affiliateCommission.findFirst({
            where: { affiliateId: affiliate.id, orderId: order.id },
            select: { id: true },
          })
          if (!existing) {
            await prisma.affiliateCommission.create({
              data: { affiliateId: affiliate.id, orderId: order.id, amount: commission, status: 'PENDING' },
            })
            await prisma.affiliate.update({
              where: { id: affiliate.id },
              data: { totalEarned: { increment: commission } },
            })
          }
        }
      }
      // Decrement inventory on payment confirmation
      if (order) {
        for (const item of order.items) {
          if (item.variantId) {
            const v = await prisma.productVariant.update({
              where: { id: item.variantId },
              data: { inventory: { decrement: item.quantity } },
              include: { product: { select: { name: true } } },
            }).catch(() => null)
            if (v && v.inventory <= LOW_STOCK_THRESHOLD) {
              await createAdminNotification({
                type: 'LOW_STOCK',
                title: `Low stock: ${v.product.name} (${v.name})`,
                body: `Variant inventory is at ${v.inventory}.`,
                link: `/admin/products/${v.productId}/edit`,
                entityType: 'ProductVariant',
                entityId: v.id,
              })
            }
          } else {
            const p = await prisma.product.update({
              where: { id: item.productId },
              data: { inventory: { decrement: item.quantity } },
            }).catch(() => null)
            if (p && p.inventory <= LOW_STOCK_THRESHOLD) {
              await createAdminNotification({
                type: 'LOW_STOCK',
                title: `Low stock: ${p.name}`,
                body: `Product inventory is at ${p.inventory}.`,
                link: `/admin/products/${p.id}/edit`,
                entityType: 'Product',
                entityId: p.id,
              })
            }
          }
        }
      }
    }

    const updated = await prisma.order.update({ where: { id: id }, data })

    // Detect status transitions that should trigger customer emails
    const customerName = prev.user?.name || 'there'
    const customerEmail = prev.email

    const becameShipped =
      data.status === 'SHIPPED' && prev.status !== 'SHIPPED'
    const becameDelivered =
      data.status === 'DELIVERED' && prev.status !== 'DELIVERED'
    const becameRefunded =
      (data.status === 'REFUNDED' && prev.status !== 'REFUNDED') ||
      (data.paymentStatus === 'REFUNDED' && prev.paymentStatus !== 'REFUNDED')

    if (becameShipped || becameDelivered || becameRefunded) {
      void (async () => {
        try {
          if (becameShipped) {
            const tpl = orderShipped({
              orderNumber: updated.orderNumber,
              customerName,
              trackingNumber: updated.trackingNumber,
              trackingUrl: updated.trackingUrl,
              carrier: null,
            })
            await sendEmail({
              to: customerEmail,
              subject: tpl.subject,
              html: tpl.html,
              text: tpl.text,
            })
          } else if (becameDelivered) {
            const tpl = orderDelivered({
              orderNumber: updated.orderNumber,
              customerName,
            })
            await sendEmail({
              to: customerEmail,
              subject: tpl.subject,
              html: tpl.html,
              text: tpl.text,
            })
          } else if (becameRefunded) {
            const tpl = orderRefunded({
              orderNumber: updated.orderNumber,
              customerName,
              amount: updated.total,
            })
            await sendEmail({
              to: customerEmail,
              subject: tpl.subject,
              html: tpl.html,
              text: tpl.text,
            })
          }
        } catch (err) {
          console.error('Order status email failed:', err)
        }
      })()
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: becameRefunded
        ? 'order.refund'
        : data.status
        ? `order.status.${data.status.toLowerCase()}`
        : 'order.update',
      entityType: 'Order',
      entityId: id,
      metadata: data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Order update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, slug: true } } } },
      user: { select: { name: true, email: true } },
      shippingAddress: true,
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}
