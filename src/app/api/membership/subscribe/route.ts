import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { sendEmail } from '@/lib/email'
import { membershipInvoice } from '@/lib/email-templates'
import { getZelleIdentity } from '@/lib/zelle'
import { generateOrderNumber } from '@/lib/utils'
import { setProductStatus } from '@/lib/products'
import { z } from 'zod'
import type { MembershipTier } from '@prisma/client'

// Customer signs up for a membership tier. We create the Membership row in
// PENDING_PAYMENT status, an unpaid Zelle invoice Order tagged as a
// membership invoice via Order.notes, and email Zelle instructions. Admin
// flips Order to PAID via mark-paid, which activates the Membership.
const subscribeSchema = z.object({
  tier: z.enum(['CLUB', 'PLUS', 'PREMIUM']),
})

const TIER_LABELS: Record<MembershipTier, string> = {
  NONE: 'Guest',
  CLUB: 'Vitality Club',
  PLUS: 'Vitality Plus',
  PREMIUM: 'Vitality Premium Stacks',
}

const TIER_SKUS: Record<'CLUB' | 'PLUS' | 'PREMIUM', string> = {
  CLUB: 'VP-MEM-CLUB',
  PLUS: 'VP-MEM-PLUS',
  PREMIUM: 'VP-MEM-PREMIUM',
}

const MEMBERSHIP_PRODUCT_SLUG = 'vitality-membership'

// Ensure the hidden Membership product + the tier's variant exist.
// Idempotent — safe to call on every subscribe.
//
// Defense in depth: on 2026-05-18 this product was found at status=ACTIVE,
// leaking onto the public /products listing as a $25 card. Root cause was
// never identified (AuditLog had zero rows). To guarantee it can never
// reappear on the storefront, every subscribe call now re-archives the
// product if it's somehow ACTIVE — via setProductStatus so the correction
// is itself audit-logged.
async function ensureMembershipVariant(tier: 'CLUB' | 'PLUS' | 'PREMIUM') {
  const benefits = TIER_BENEFITS[tier]
  const product = await prisma.product.upsert({
    where: { slug: MEMBERSHIP_PRODUCT_SLUG },
    update: {},
    create: {
      slug: MEMBERSHIP_PRODUCT_SLUG,
      name: 'Vitality Membership',
      shortDesc: 'Monthly membership — billed via Zelle',
      description:
        'Membership billing line item. Not for direct purchase — placed via the /membership flow.',
      price: 2500,
      status: 'ARCHIVED',
      trackInventory: false,
      sku: 'VP-MEM',
    },
  })
  // Re-archive if it ever drifts to ACTIVE.
  if (product.status === 'ACTIVE') {
    await setProductStatus(product.id, 'ARCHIVED', {
      source: 'membership/subscribe (auto-correct)',
    })
  }
  const existingVariant = await prisma.productVariant.findFirst({
    where: { productId: product.id, name: TIER_LABELS[tier] },
  })
  const variant = existingVariant
    ? await prisma.productVariant.update({
        where: { id: existingVariant.id },
        data: { price: benefits.monthlyPriceCents },
      })
    : await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: TIER_LABELS[tier],
          sku: TIER_SKUS[tier],
          price: benefits.monthlyPriceCents,
          inventory: 0,
        },
      })
  return { product, variant }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Sign in to subscribe' },
        { status: 401 },
      )
    }
    const body = await req.json().catch(() => ({}))
    const { tier } = subscribeSchema.parse(body)

    // Already ACTIVE on this tier? Idempotent return.
    const existing = await prisma.membership.findUnique({
      where: { userId: session.user.id },
    })
    if (existing && existing.tier === tier && existing.status === 'ACTIVE') {
      return NextResponse.json({
        ok: true,
        alreadyActive: true,
        membership: existing,
      })
    }
    // Already PENDING_PAYMENT on this tier with an open invoice?
    if (
      existing &&
      existing.tier === tier &&
      existing.status === 'PENDING_PAYMENT' &&
      existing.pendingInvoiceOrderId
    ) {
      const openInvoice = await prisma.order.findUnique({
        where: { id: existing.pendingInvoiceOrderId },
        select: { id: true, orderNumber: true, paymentStatus: true, total: true },
      })
      if (openInvoice && openInvoice.paymentStatus === 'UNPAID') {
        return NextResponse.json({
          ok: true,
          alreadyPending: true,
          orderNumber: openInvoice.orderNumber,
          total: openInvoice.total,
        })
      }
    }

    const benefits = TIER_BENEFITS[tier]
    const { product, variant } = await ensureMembershipVariant(tier)

    // Upsert the Membership row in PENDING_PAYMENT.
    const membership = await prisma.membership.upsert({
      where: { userId: session.user.id },
      update: {
        tier,
        status: 'PENDING_PAYMENT',
        monthlyPriceCents: benefits.monthlyPriceCents,
        paymentProvider: 'zelle',
        cancelledAt: null,
      },
      create: {
        userId: session.user.id,
        tier,
        status: 'PENDING_PAYMENT',
        monthlyPriceCents: benefits.monthlyPriceCents,
        paymentProvider: 'zelle',
      },
    })

    // Create the first Zelle invoice Order. Tag it via notes so mark-paid
    // can route it to membership activation.
    const orderNumber = generateOrderNumber()
    const lineName = `${TIER_LABELS[tier]} — Monthly Membership`
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: session.user.id,
        email: session.user.email!,
        subtotal: benefits.monthlyPriceCents,
        total: benefits.monthlyPriceCents,
        paymentMethod: 'zelle',
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        notes: `MEMBERSHIP:${membership.id}:${tier}`,
        items: {
          create: [
            {
              productId: product.id,
              variantId: variant.id,
              name: lineName,
              sku: variant.sku,
              price: benefits.monthlyPriceCents,
              quantity: 1,
              total: benefits.monthlyPriceCents,
            },
          ],
        },
      },
    })

    await prisma.membership.update({
      where: { id: membership.id },
      data: { pendingInvoiceOrderId: order.id },
    })

    // Email Zelle instructions via the dedicated membership template. The
    // Order.notes "MEMBERSHIP:..." marker is what mark-paid uses to flip
    // the Membership to ACTIVE once Edward confirms the Zelle deposit.
    const zelle = await getZelleIdentity()
    void (async () => {
      try {
        const html = membershipInvoice({
          name: session.user.name ?? null,
          planLabel: TIER_LABELS[tier],
          amountCents: benefits.monthlyPriceCents,
          invoiceNumber: order.orderNumber,
          zelle,
        })
        const amount = `$${(benefits.monthlyPriceCents / 100).toFixed(2)}`
        const text = `Hi ${session.user.name?.split(' ')[0] ?? 'there'},

Thanks for joining The Vitality Project. To activate your ${TIER_LABELS[tier]} membership, send ${amount} via Zelle to ${zelle.primary}${zelle.altHandle ? ` (or ${zelle.altHandle})` : ''}.

Memo: ${order.orderNumber}
Amount: ${amount}

Membership turns on the moment funds arrive — usually same day.

— The Vitality Project`
        await sendEmail({
          to: session.user.email!,
          subject: `Activate your ${TIER_LABELS[tier]} membership — Zelle ${amount}`,
          html,
          text,
        })
      } catch (err) {
        console.error('[membership/subscribe] email send failed:', err)
      }
    })()

    return NextResponse.json({
      ok: true,
      membershipId: membership.id,
      orderNumber: order.orderNumber,
      total: order.total,
      tier,
    })
  } catch (error) {
    console.error('[membership/subscribe] error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Subscribe failed' },
      { status: 500 },
    )
  }
}
