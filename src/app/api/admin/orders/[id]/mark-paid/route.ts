import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { membershipActivated, membershipCycleCredits, zellePaymentConfirmed } from '@/lib/email-templates'
import { TIER_BENEFITS } from '@/lib/membership'
import { routeOrderToFacilities } from '@/lib/fulfillment'
import { awardPointsForOrder } from '@/lib/loyalty'

const MEMBERSHIP_NOTE_PREFIX = 'MEMBERSHIP:'
const TIER_LABELS: Record<string, string> = {
  CLUB: 'Vitality Club',
  PLUS: 'Vitality Plus',
  PREMIUM: 'Vitality Premium Stacks',
}

// If this order is a membership invoice (notes starts with "MEMBERSHIP:<id>:<tier>"),
// flip the Membership to ACTIVE, stamp paymentConfirmedAt, push renewsAt 30d
// forward, and email the customer that they're activated.
async function activateMembershipFromOrder(order: {
  id: string
  notes: string | null
  email: string
  user: { name: string | null } | null
}) {
  if (!order.notes?.startsWith(MEMBERSHIP_NOTE_PREFIX)) return
  const [, membershipId, tier] = order.notes.split(':')
  if (!membershipId) return

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
  })
  if (!membership) return

  const now = new Date()
  // Rolling 30-day cycle. If renewsAt is in the future (renewal flow), push
  // from there; otherwise start a fresh cycle from now.
  const baseDate =
    membership.renewsAt && membership.renewsAt > now ? membership.renewsAt : now
  const renewsAt = new Date(baseDate.getTime() + 30 * 86400e3)

  const isFirstActivation = !membership.paymentConfirmedAt
  const tierKey =
    tier === 'CLUB' || tier === 'PLUS' || tier === 'PREMIUM' ? tier : null
  const benefits = tierKey ? TIER_BENEFITS[tierKey] : TIER_BENEFITS.NONE

  await prisma.membership.update({
    where: { id: membershipId },
    data: {
      status: 'ACTIVE',
      paymentConfirmedAt: membership.paymentConfirmedAt ?? now,
      renewsAt,
      pendingInvoiceOrderId:
        membership.pendingInvoiceOrderId === order.id
          ? null
          : membership.pendingInvoiceOrderId,
      // Grant this cycle's allotment. Use-it-or-lose-it: each paid cycle
      // overwrites the prior balance (peptides reuse the existing counters;
      // supplies are a single per-cycle flag).
      freePeptideCreditsThisPeriod: benefits.freePeptideCreditsPerPeriod,
      freePeptidesUsedThisPeriod: 0,
      freeSuppliesClaimedThisPeriod: false,
    },
  })

  void (async () => {
    try {
      const planLabel = TIER_LABELS[tier] ?? 'Membership'
      const name = order.user?.name ?? 'there'
      // First payment → welcome (with this month's credits called out).
      // Renewal with credits → "your credits refreshed". Renewal with no
      // credits (Club) → nothing extra; the payment-confirmed email covers it.
      const tpl = isFirstActivation
        ? membershipActivated({
            name,
            plan: planLabel,
            discountPct: benefits.permanentDiscountPct,
            peptideCredits: benefits.freePeptideCreditsPerPeriod,
            includesSupplies: benefits.freeBacAndSyringes,
            freeShipping: benefits.freeShipping,
          })
        : benefits.freePeptideCreditsPerPeriod > 0
          ? membershipCycleCredits({
              name,
              planLabel,
              peptideCredits: benefits.freePeptideCreditsPerPeriod,
              includesSupplies: benefits.freeBacAndSyringes,
            })
          : null
      if (tpl) {
        await sendEmail({
          to: order.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        })
      }
    } catch (err) {
      console.error('[mark-paid] membership activation email failed:', err)
    }
  })()
}

// Admin-only. Flips a Zelle order from UNPAID → PAID, fires fulfillment
// routing, and emails the customer that we received their payment.
// Idempotent: if already PAID, returns 200 with a no-op result.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      email: true,
      total: true,
      subtotal: true,
      shipping: true,
      tax: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      notes: true,
      userId: true,
      affiliateId: true,
      items: { select: { name: true, sku: true, quantity: true, price: true, total: true } },
      shippingAddress: {
        select: {
          name: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
        },
      },
      user: { select: { name: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.paymentStatus === 'PAID') {
    return NextResponse.json({
      ok: true,
      alreadyPaid: true,
      orderId: order.id,
    })
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      status: order.status === 'PENDING' ? 'PROCESSING' : order.status,
      paymentId:
        // Mark internally as a manually-confirmed Zelle deposit so the audit
        // trail shows it wasn't a card transaction.
        `zelle_manual_${Date.now().toString(36)}`,
    },
  })

  // Membership invoice? Activate the membership instead of routing to a
  // physical facility (memberships have no fulfillment). Membership invoices
  // intentionally DON'T trigger affiliate commissions.
  if (order.notes?.startsWith(MEMBERSHIP_NOTE_PREFIX)) {
    try {
      await activateMembershipFromOrder(order)
    } catch (err) {
      console.error('[mark-paid] membership activation failed:', err)
    }
  } else {
    // Physical-goods order — route to fulfillment + credit affiliate (if any).
    try {
      await routeOrderToFacilities(order.id)
    } catch (err) {
      console.error('[mark-paid] fulfillment routing failed:', err)
    }

    // Loyalty points — award after payment confirmation (not at placement)
    // so partial-pay or cancelled orders never earn points. Memberships
    // intentionally don't earn loyalty either (handled by the early return
    // above).
    if (order.userId) {
      try {
        await awardPointsForOrder({
          userId: order.userId,
          orderId: order.id,
          orderTotal: order.total,
        })
      } catch (err) {
        console.error('[mark-paid] loyalty award failed:', err)
      }
    }

    if (order.affiliateId) {
      try {
        const aff = await prisma.affiliate.findUnique({
          where: { id: order.affiliateId },
          select: { id: true, commissionRate: true },
        })
        if (aff) {
          const amount = Math.round(order.total * aff.commissionRate)
          // Idempotent: only create one commission per (affiliate, order).
          const existing = await prisma.affiliateCommission.findFirst({
            where: { affiliateId: aff.id, orderId: order.id },
            select: { id: true },
          })
          if (!existing) {
            await prisma.affiliateCommission.create({
              data: {
                affiliateId: aff.id,
                orderId: order.id,
                amount,
                status: 'PENDING',
              },
            })
            await prisma.affiliate.update({
              where: { id: aff.id },
              data: { totalEarned: { increment: amount } },
            })
          }
        }
      } catch (err) {
        console.error('[mark-paid] affiliate commission failed:', err)
      }
    }
  }

  // Customer "we got your payment" email — fire-and-forget.
  void (async () => {
    try {
      const customerName =
        order.shippingAddress?.name || order.user?.name || 'there'
      const tpl = zellePaymentConfirmed({
        orderNumber: order.orderNumber,
        customerName,
        total: order.total,
      })
      await sendEmail({
        to: order.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      })
    } catch (err) {
      console.error('[mark-paid] payment-confirmed email failed:', err)
    }
  })()

  // Admin "go ship this" email — only for physical orders (not memberships).
  // Manual fulfillment phase: this is the trigger telling the owner the
  // money's in hand and the package can go out the door.
  if (!order.notes?.startsWith(MEMBERSHIP_NOTE_PREFIX)) {
    void (async () => {
      try {
        const adminEmail = process.env.ADMIN_EMAIL
        if (!adminEmail || !order.shippingAddress) return
        const itemsList = order.items
          .map(
            (it) =>
              `  • ${it.name}${it.sku ? ` [${it.sku}]` : ''} × ${it.quantity}  ($${(it.total / 100).toFixed(2)})`,
          )
          .join('\n')
        const a = order.shippingAddress
        const address = [
          a.name,
          a.line1,
          a.line2,
          `${a.city}, ${a.state} ${a.zip}`,
          a.country ?? 'US',
        ]
          .filter(Boolean)
          .join('\n')
        const text = `Order #${order.orderNumber} is PAID — ready to ship.

Items:
${itemsList}

Subtotal: $${(order.subtotal / 100).toFixed(2)}
Shipping: $${(order.shipping / 100).toFixed(2)}
Tax:      $${(order.tax / 100).toFixed(2)}
Total:    $${(order.total / 100).toFixed(2)}

Ship to:
${address}

Customer email: ${order.email}

Open in admin: ${process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'}/admin/orders/${order.id}`
        const itemsHtml = order.items
          .map(
            (it) =>
              `<tr><td style="padding:4px 8px 4px 0;color:#e5e7eb;font-size:13px;">${it.name}${it.sku ? ` <code style="color:#888;font-size:11px;">[${it.sku}]</code>` : ''} × ${it.quantity}</td><td align="right" style="padding:4px 0;color:#fff;font-family:ui-monospace;font-size:13px;">$${(it.total / 100).toFixed(2)}</td></tr>`,
          )
          .join('')
        const html = `<!doctype html><html><body style="margin:0;background:#0c0e1a;color:#cbd5e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px 16px;">
<div style="max-width:600px;margin:0 auto;background:rgba(20,24,42,0.7);border:1px solid rgba(16,185,129,0.4);border-radius:14px;padding:24px 28px;">
  <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#34d399;margin-bottom:6px;">Ready to ship — payment confirmed</div>
  <h1 style="margin:0 0 14px;font-size:22px;color:#fff;">Order #${order.orderNumber}</h1>
  <div style="background:#0c0e1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin:0 0 14px;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;color:#9ca3af;text-transform:uppercase;">Items</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${itemsHtml}</table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-top:1px dashed rgba(255,255,255,0.1);padding-top:10px;">
      <tr><td style="font-size:13px;color:#9ca3af;">Subtotal</td><td align="right" style="font-size:13px;color:#e5e7eb;font-family:ui-monospace;">$${(order.subtotal / 100).toFixed(2)}</td></tr>
      <tr><td style="font-size:13px;color:#9ca3af;">Shipping</td><td align="right" style="font-size:13px;color:#e5e7eb;font-family:ui-monospace;">$${(order.shipping / 100).toFixed(2)}</td></tr>
      <tr><td style="font-size:13px;color:#9ca3af;">Tax</td><td align="right" style="font-size:13px;color:#e5e7eb;font-family:ui-monospace;">$${(order.tax / 100).toFixed(2)}</td></tr>
      <tr><td style="padding-top:6px;font-size:14px;color:#fff;font-weight:700;">Total paid</td><td align="right" style="padding-top:6px;font-size:16px;color:#fff;font-weight:700;font-family:ui-monospace;">$${(order.total / 100).toFixed(2)}</td></tr>
    </table>
  </div>
  <div style="background:#0c0e1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin:0 0 14px;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;color:#9ca3af;text-transform:uppercase;">Ship to</p>
    <p style="margin:0;font-size:13px;color:#e5e7eb;line-height:1.5;">
      ${a.name}<br/>${a.line1}<br/>${a.line2 ? a.line2 + '<br/>' : ''}${a.city}, ${a.state} ${a.zip}<br/>${a.country ?? 'US'}
    </p>
    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">Customer email: ${order.email}</p>
  </div>
  <div style="text-align:center;margin:18px 0;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'}/admin/orders/${order.id}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:9px;">Open order in admin</a>
  </div>
  <p style="margin:0;font-size:12px;color:#94a3b8;">Manual-fulfillment phase: paste the address above into your label tool and ship.</p>
</div></body></html>`
        await sendEmail({
          to: adminEmail,
          subject: `[ship] #${order.orderNumber} paid — $${(order.total / 100).toFixed(2)} — ${order.shippingAddress.city}, ${order.shippingAddress.state}`,
          html,
          text,
        })
      } catch (err) {
        console.error('[mark-paid] admin ship-alert email failed:', err)
      }
    })()
  }

  return NextResponse.json({
    ok: true,
    orderId: updated.id,
    orderNumber: updated.orderNumber,
    paymentStatus: updated.paymentStatus,
    status: updated.status,
  })
}
