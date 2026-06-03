import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber, formatPrice } from '@/lib/utils'
import { resolveTenantFromHost } from '@/lib/tenant'
import { sendOwnerSms } from '@/lib/sms'
import { sendEmail } from '@/lib/email'
import {
  zelleOrderInstructions,
  zelleOrderAdminAlert,
} from '@/lib/email-templates'
import { calculateShipping } from '@/lib/shipping'
import { calculateTaxAsync } from '@/lib/tax'
import { z } from 'zod'

// Customer-driven Zelle checkout. Creates an order in PENDING / UNPAID state
// with paymentMethod = 'zelle'. No money has changed hands at this point —
// admin manually confirms via /api/admin/orders/:id/mark-paid once the Zelle
// deposit appears in the receiving account, which is what releases fulfillment.
const zelleCheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1, 'Cart is empty'),
  email: z.string().email(),
  shippingAddress: z.object({
    name: z.string().min(1),
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(2),
    zip: z.string().min(3),
    country: z.string().default('US'),
  }),
  discountCode: z.string().optional(),
  // Optional loyalty redemption — points to spend on this order. Server
  // validates against the user's current balance before applying.
  loyaltyPointsToRedeem: z.number().int().min(0).optional(),
})

async function getZelleConfig(): Promise<{
  // `email` here is the *primary identifier* shown to the customer — could
  // actually be a phone number if the business registered Zelle by phone
  // (e.g., Vertex Research Supply uses a phone-only Zelle). Template label
  // "Send Zelle to" is generic enough to work for either.
  email: string
  displayName?: string
  phone?: string
}> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ['zelleEmail', 'zelleDisplayName', 'zellePhone'] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value?.trim() || '']))
  const primary =
    map.zelleEmail ||
    map.zellePhone ||
    process.env.ADMIN_EMAIL ||
    'edward@giddyupp.com'
  // Only surface the secondary "Or by phone" line if BOTH email AND phone are
  // set distinctly — avoids showing the same value twice when phone-only.
  const showSecondary = !!map.zelleEmail && !!map.zellePhone
  return {
    email: primary,
    displayName: map.zelleDisplayName || undefined,
    phone: showSecondary ? map.zellePhone : undefined,
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Sign in to place an order' },
        { status: 401 },
      )
    }

    const host =
      req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
    const { tenantSlug, isReserved } = resolveTenantFromHost(host)

    let organizationId: string | undefined
    let locationId: string | undefined
    let clientId: string | undefined
    let salesChannel: 'DIRECT' | 'CLIENT_PORTAL' = 'DIRECT'

    if (tenantSlug && !isReserved) {
      const org = await prisma.organization.findUnique({
        where: { slug: tenantSlug },
      })
      if (!org) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 },
        )
      }
      organizationId = org.id
      salesChannel = 'CLIENT_PORTAL'
      const client = await prisma.orgClient.findUnique({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: session.user.id,
          },
        },
      })
      if (client) {
        clientId = client.id
        locationId = client.locationId ?? undefined
      }
    }

    const body = await req.json()
    const data = zelleCheckoutSchema.parse(body)

    const productIds = data.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE' },
      include: { variants: true },
    })

    let subtotal = 0
    const orderItems = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)
      if (!product) {
        throw new Error(`Product ${item.productId} not found or inactive`)
      }
      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : null
      const price = variant?.price ?? product.price
      const itemTotal = price * item.quantity
      subtotal += itemTotal
      return {
        productId: product.id,
        variantId: item.variantId,
        name: product.name + (variant ? ` — ${variant.name}` : ''),
        sku: variant?.sku ?? product.sku ?? undefined,
        price,
        quantity: item.quantity,
        total: itemTotal,
      }
    })

    let discount = 0
    let appliedDiscountCodeId: string | null = null
    if (data.discountCode) {
      const code = await prisma.discountCode.findUnique({
        where: { code: data.discountCode.toUpperCase(), active: true },
      })
      if (
        code &&
        (!code.expiresAt || code.expiresAt > new Date()) &&
        (!code.maxUses || code.usedCount < code.maxUses)
      ) {
        discount =
          code.type === 'PERCENTAGE'
            ? Math.round(subtotal * (code.value / 100))
            : Math.min(code.value, subtotal)
        appliedDiscountCodeId = code.id
      }
    }

    // Loyalty redemption — validate balance and convert to discount cents.
    // 1 point = 1 cent. The redemption is applied AFTER discount-code discount
    // but BEFORE shipping/tax so points reduce the taxable base too. The
    // actual ledger mutation happens after the Order row is created so we
    // can pass orderId into redeemPointsForOrder.
    let loyaltyPointsToUse = 0
    let loyaltyDiscount = 0
    if (
      data.loyaltyPointsToRedeem &&
      data.loyaltyPointsToRedeem > 0 &&
      !locationId // never redeem on B2B tenant orders
    ) {
      const account = await prisma.loyaltyAccount.findUnique({
        where: { userId: session.user.id },
        select: { points: true },
      })
      const available = account?.points ?? 0
      // Cap to the remaining subtotal after discount-code so the order
      // never goes negative on the cart total.
      const remainingAfterDiscount = Math.max(0, subtotal - discount)
      loyaltyPointsToUse = Math.max(
        0,
        Math.min(data.loyaltyPointsToRedeem, available, remainingAfterDiscount),
      )
      loyaltyDiscount = loyaltyPointsToUse // 1pt = 1c
    }

    const { rate: shippingCost } = await calculateShipping(
      subtotal,
      data.shippingAddress.country,
      data.shippingAddress.state,
    )
    const taxableBase = Math.max(0, subtotal - discount - loyaltyDiscount)
    const taxAmount = await calculateTaxAsync(
      taxableBase,
      data.shippingAddress.state,
      { organizationId },
    )
    const total = Math.max(
      0,
      subtotal - discount - loyaltyDiscount + shippingCost + taxAmount,
    )

    const orderNumber = generateOrderNumber()

    const shippingAddress =
      (await prisma.address.findFirst({
        where: {
          userId: session.user.id,
          line1: data.shippingAddress.line1,
          zip: data.shippingAddress.zip,
        },
      })) ??
      (await prisma.address
        .create({
          data: {
            userId: session.user.id,
            name: data.shippingAddress.name,
            line1: data.shippingAddress.line1,
            line2: data.shippingAddress.line2,
            city: data.shippingAddress.city,
            state: data.shippingAddress.state,
            zip: data.shippingAddress.zip,
            country: data.shippingAddress.country,
          },
        })
        .catch(() => null))

    // Pull the affiliate cookie (set by /r/<code>, /ref/<code>, or /api/affiliate/track)
    // and resolve it to an active Affiliate. Skipped for tenant/B2B traffic where
    // the location already owns the commission split.
    const affCode = req.cookies.get('aff_code')?.value
    let resolvedAffiliateId: string | null = null
    let resolvedAffiliateCode: string | null = null
    if (affCode && !locationId) {
      const aff = await prisma.affiliate.findUnique({
        where: { code: affCode.toUpperCase() },
        select: { id: true, code: true, status: true },
      })
      if (aff && aff.status === 'ACTIVE') {
        resolvedAffiliateId = aff.id
        resolvedAffiliateCode = aff.code
      }
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: session.user.id,
        email: data.email,
        subtotal,
        discount,
        shipping: shippingCost,
        tax: taxAmount,
        total,
        discountCode: data.discountCode,
        paymentMethod: 'zelle',
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        organizationId,
        locationId,
        clientId,
        salesChannel,
        shippingAddressId: shippingAddress?.id,
        affiliateId: resolvedAffiliateId,
        affiliateCode: resolvedAffiliateCode,
        loyaltyPointsUsed: loyaltyPointsToUse,
        items: { create: orderItems },
      },
    })

    if (appliedDiscountCodeId) {
      await prisma.discountCode.update({
        where: { id: appliedDiscountCodeId },
        data: { usedCount: { increment: 1 } },
      })
    }

    // Burn the loyalty points now that the order row exists — passes orderId
    // for the ledger transaction. If this fails the order still stands but
    // the points won't be debited; admin can reconcile manually. Wrapping
    // in a transaction across order.create above would be ideal long-term.
    if (loyaltyPointsToUse > 0) {
      try {
        const { redeemPointsForOrder } = await import('@/lib/loyalty')
        await redeemPointsForOrder({
          userId: session.user.id,
          pointsToRedeem: loyaltyPointsToUse,
          orderId: order.id,
        })
      } catch (err) {
        console.error('[checkout-zelle] loyalty redemption failed:', err)
      }
    }

    // Clear server-side cart_items for this user so the abandoned-cart cron
    // doesn't pester them while they're still mid-Zelle-transfer. Best-effort
    // — failure here doesn't break the order.
    await prisma.cartItem
      .deleteMany({ where: { userId: session.user.id } })
      .catch((err) => console.error('[checkout-zelle] cart clear failed:', err))

    const zelleConfig = await getZelleConfig()
    const customerName =
      data.shippingAddress.name || session.user.name || 'there'

    void (async () => {
      try {
        const instructions = zelleOrderInstructions({
          orderNumber: order.orderNumber,
          customerName,
          items: orderItems.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            total: it.total,
          })),
          subtotal,
          total,
          shippingAddress: data.shippingAddress,
          zelleEmail: zelleConfig.email,
          zelleDisplayName: zelleConfig.displayName,
          zellePhone: zelleConfig.phone,
        })
        await sendEmail({
          to: data.email,
          subject: instructions.subject,
          html: instructions.html,
          text: instructions.text,
        })

        const adminEmail = process.env.ADMIN_EMAIL
        if (adminEmail) {
          const alert = zelleOrderAdminAlert({
            orderNumber: order.orderNumber,
            orderId: order.id,
            customerName,
            customerEmail: data.email,
            total,
            itemCount: orderItems.length,
            items: orderItems.map((it) => ({
              name: it.name,
              quantity: it.quantity,
              price: it.price,
              total: it.total,
            })),
            shippingAddress: data.shippingAddress,
          })
          await sendEmail({
            to: adminEmail,
            subject: alert.subject,
            html: alert.html,
            text: alert.text,
          })
        }

        // Text the business owner — Zelle orders need a manual "mark paid".
        void sendOwnerSms(
          `Vitality: new Zelle order ${order.orderNumber} — ${formatPrice(total)} from ${customerName}. Awaiting payment; mark paid in admin when funds land.`,
        )
      } catch (err) {
        console.error('[checkout-zelle] email send failed:', err)
      }
    })()

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      shipping: shippingCost,
      tax: taxAmount,
      zelleEmail: zelleConfig.email,
      paymentMethod: 'zelle',
      paymentStatus: 'UNPAID',
    })
  } catch (error) {
    console.error('[checkout-zelle] error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 },
    )
  }
}
