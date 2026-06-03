import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber, formatPrice } from '@/lib/utils'
import { processPayment, validateCard, type CardDetails } from '@/lib/payments'
import { sendOwnerSms } from '@/lib/sms'
import { resolveTenantFromHost } from '@/lib/tenant'
import { sendEmail } from '@/lib/email'
import {
  orderConfirmation,
  newOrderAlert,
} from '@/lib/email-templates'
import { calculateShipping } from '@/lib/shipping'
import { calculateTax } from '@/lib/tax'
import {
  applyStoreCredit,
} from '@/lib/store-credit'
import {
  awardPointsForOrder,
  redeemPointsForOrder,
  pointsToDiscountCents,
} from '@/lib/loyalty'
import { routeOrderToFacilities } from '@/lib/fulfillment'
import { attributeOrderToCampaigns } from '@/lib/campaign-attribution'
import { z } from 'zod'

const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().min(1),
  })),
  email: z.string().email(),
  shippingAddress: z.object({
    name: z.string(),
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('US'),
  }),
  discountCode: z.string().optional(),
  useStoreCredit: z.boolean().optional().default(false),
  useLoyaltyPoints: z.number().int().min(0).optional().default(0),
  card: z.object({
    number: z.string(),
    expMonth: z.string(),
    expYear: z.string(),
    cvv: z.string(),
    name: z.string(),
    zip: z.string(),
  }),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Resolve tenant context (gym/clinic kiosk or direct)
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
    const { tenantSlug, isReserved } = resolveTenantFromHost(host)

    let organizationId: string | undefined
    let locationId: string | undefined
    let clientId: string | undefined
    let salesChannel: 'DIRECT' | 'CLIENT_PORTAL' = 'DIRECT'

    if (tenantSlug && !isReserved) {
      const org = await prisma.organization.findUnique({ where: { slug: tenantSlug } })
      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }
      organizationId = org.id
      salesChannel = 'CLIENT_PORTAL'
      const client = await prisma.orgClient.findUnique({
        where: { organizationId_userId: { organizationId: org.id, userId: session.user.id } },
      })
      if (client) {
        clientId = client.id
        locationId = client.locationId ?? undefined
      }
    }

    const body = await req.json()
    const data = checkoutSchema.parse(body)

    const cardError = validateCard(data.card as CardDetails)
    if (cardError) {
      return NextResponse.json({ error: cardError }, { status: 400 })
    }

    const productIds = data.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE' },
      include: { variants: true },
    })

    let subtotal = 0
    const orderItems = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)
      if (!product) throw new Error(`Product ${item.productId} not found`)
      const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null
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
      if (code && (!code.expiresAt || code.expiresAt > new Date()) && (!code.maxUses || code.usedCount < code.maxUses)) {
        discount = code.type === 'PERCENTAGE'
          ? Math.round(subtotal * (code.value / 100))
          : Math.min(code.value, subtotal)
        appliedDiscountCodeId = code.id
      }
    }

    // Shipping & tax based on destination
    const { rate: shippingCost } = await calculateShipping(
      subtotal,
      data.shippingAddress.country,
      data.shippingAddress.state
    )
    const taxableBase = Math.max(0, subtotal - discount)
    const taxAmount = calculateTax(taxableBase, data.shippingAddress.state)

    // Preview how many points the user wants to redeem, clamped to their balance.
    let plannedPointsRedeem = 0
    let plannedPointsDiscount = 0
    if (data.useLoyaltyPoints && data.useLoyaltyPoints > 0) {
      const acct = await prisma.loyaltyAccount.findUnique({
        where: { userId: session.user.id },
      })
      const available = acct?.points ?? 0
      plannedPointsRedeem = Math.min(data.useLoyaltyPoints, available)
      plannedPointsDiscount = pointsToDiscountCents(plannedPointsRedeem)
    }

    // Preview store credit (actual apply happens once we have orderId)
    let plannedCreditUse = 0
    if (data.useStoreCredit) {
      const cred = await prisma.storeCredit.findUnique({
        where: { userId: session.user.id },
      })
      plannedCreditUse = Math.max(0, cred?.balance ?? 0)
    }

    // Order-level preview total: subtotal - discount - pointsDiscount - credit + shipping + tax
    const preCreditTotal = Math.max(
      0,
      subtotal - discount - plannedPointsDiscount + shippingCost + taxAmount
    )
    const actualCreditUse = Math.min(plannedCreditUse, preCreditTotal)
    const total = preCreditTotal - actualCreditUse

    const orderNumber = generateOrderNumber()

    // Only charge the card for the remaining balance.
    let paymentTransactionId: string | undefined
    if (total > 0) {
      const paymentResult = await processPayment(
        total,
        data.card as CardDetails,
        orderNumber,
        { email: data.email, userId: session.user.id }
      )

      if (!paymentResult.success) {
        return NextResponse.json(
          { error: paymentResult.error ?? 'Payment failed. Please check your card details and try again.' },
          { status: 402 }
        )
      }
      paymentTransactionId = paymentResult.transactionId
    } else {
      paymentTransactionId = `no_charge_${Date.now().toString(36)}`
    }

    const shippingAddress = await prisma.address.findFirst({
      where: { userId: session.user.id, line1: data.shippingAddress.line1, zip: data.shippingAddress.zip },
    }) ?? await prisma.address.create({
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
    }).catch(() => null)

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
        paymentMethod: 'card',
        paymentStatus: 'PAID',
        paymentId: paymentTransactionId,
        status: 'PROCESSING',
        organizationId,
        locationId,
        clientId,
        salesChannel,
        shippingAddressId: shippingAddress?.id,
        items: { create: orderItems },
      },
    })

    if (appliedDiscountCodeId) {
      await prisma.discountCode.update({
        where: { id: appliedDiscountCodeId },
        data: { usedCount: { increment: 1 } },
      })
    }

    // Actually debit loyalty points + store credit now that the order exists.
    let pointsUsed = 0
    if (plannedPointsRedeem > 0) {
      const redeemed = await redeemPointsForOrder({
        userId: session.user.id,
        pointsToRedeem: plannedPointsRedeem,
        orderId: order.id,
      })
      pointsUsed = redeemed.pointsUsed
    }

    let creditApplied = 0
    if (actualCreditUse > 0) {
      creditApplied = await applyStoreCredit({
        userId: session.user.id,
        requested: actualCreditUse,
        maxAmount: preCreditTotal,
        orderId: order.id,
      })
    }

    // Award loyalty points based on what the customer actually paid.
    const pointsEarned = await awardPointsForOrder({
      userId: session.user.id,
      orderId: order.id,
      orderTotal: total + creditApplied, // total + credit = taxed+shipped price, excluding points discount
    }).then((r) => r.pointsEarned).catch(() => 0)

    await prisma.order.update({
      where: { id: order.id },
      data: {
        storeCreditUsed: creditApplied,
        loyaltyPointsUsed: pointsUsed,
        loyaltyPointsEarned: pointsEarned,
      },
    })

    // Route items to facilities for fulfillment
    try {
      await routeOrderToFacilities(order.id)
    } catch (err) {
      console.error('Fulfillment routing failed:', err)
    }

    // Location commission (gym/clinic gets a cut)
    if (locationId) {
      const location = await prisma.location.findUnique({
        where: { id: locationId },
        select: { commissionRate: true },
      })
      const commissionRate = location?.commissionRate ?? 0
      const commissionAmount = Math.round(order.total * commissionRate)
      if (commissionAmount > 0) {
        await prisma.orderCommission.upsert({
          where: { orderId_locationId: { orderId: order.id, locationId } },
          update: {},
          create: { orderId: order.id, locationId, amount: commissionAmount, status: 'PENDING' },
        })
      }
    }

    // Affiliate commission
    const affCode = req.cookies.get('aff_code')?.value
    if (affCode && !locationId) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: affCode, status: 'ACTIVE' } })
      if (affiliate) {
        const commission = Math.round(total * affiliate.commissionRate)
        await prisma.affiliateCommission.create({
          data: { affiliateId: affiliate.id, orderId: order.id, amount: commission, status: 'PENDING' },
        })
        await prisma.affiliate.update({
          where: { id: affiliate.id },
          data: { totalEarned: { increment: commission } },
        })
      }
    }

    // Fire-and-forget transactional emails (do not block the response / do not break checkout on failure)
    void (async () => {
      try {
        const confirmation = orderConfirmation({
          orderNumber: order.orderNumber,
          customerName: data.shippingAddress.name || session.user.name || 'there',
          items: orderItems.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            total: it.total,
          })),
          subtotal,
          total,
          shippingAddress: data.shippingAddress,
        })
        await sendEmail({
          to: data.email,
          subject: confirmation.subject,
          html: confirmation.html,
          text: confirmation.text,
        })

        const adminEmail = process.env.ADMIN_EMAIL
        if (adminEmail) {
          const alert = newOrderAlert({
            adminEmail,
            orderNumber: order.orderNumber,
            total,
            customerEmail: data.email,
          })
          await sendEmail({
            to: adminEmail,
            subject: alert.subject,
            html: alert.html,
            text: alert.text,
          })
        }

        // Text the business owner — best-effort, never blocks the response.
        void sendOwnerSms(
          `Vitality: new order ${order.orderNumber} — ${formatPrice(total)} from ${data.email}`,
        )
      } catch (err) {
        console.error('Order email send failed:', err)
      }
    })()

    // Fire-and-forget: attribute this order to any recently-opened campaign
    attributeOrderToCampaigns(order.id, session.user.id, total).catch(() => {})

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      shipping: shippingCost,
      tax: taxAmount,
      storeCreditUsed: creditApplied,
      loyaltyPointsUsed: pointsUsed,
      loyaltyPointsEarned: pointsEarned,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
