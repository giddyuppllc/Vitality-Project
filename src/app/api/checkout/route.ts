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
import { calculateTaxAsync } from '@/lib/tax'
import { computeCartTotal, UnorderableLineError } from '@/lib/pricing'
import { consumePeptideCredits, PeptideCreditsChangedError, TIER_BENEFITS } from '@/lib/membership'
import { InsufficientCreditError } from '@/lib/order-credit'
import { resolveOrderAffiliate } from '@/lib/affiliate-tracking'
import {
  claimDiscountCodeUse,
  DiscountCodeError,
  normalizeDiscountCode,
  priceDiscountCode,
} from '@/lib/checkout-discount'
import {
  awardPointsForOrder,
  InsufficientPointsError,
  maxRedeemablePoints,
  pointsToDiscountCents,
} from '@/lib/loyalty'
import { routeOrderToFacilities } from '@/lib/fulfillment'
import { attributeOrderToCampaigns } from '@/lib/campaign-attribution'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { z } from 'zod'
import { decrementStock } from '@/lib/inventory'

/** Credit/points debited before the card is charged; released if no order results. */
type Reservation = {
  userId: string
  credit: number
  points: number
  peptideCredits: number
  membershipId: string | null
} | null

async function releaseReservation(r: Reservation) {
  if (!r) return
  try {
    await prisma.$transaction(async (tx) => {
      if (r.credit > 0) {
        await tx.storeCredit.update({
          where: { userId: r.userId },
          data: { balance: { increment: r.credit } },
        })
      }
      if (r.points > 0) {
        await tx.loyaltyAccount.update({
          where: { userId: r.userId },
          data: { points: { increment: r.points } },
        })
      }
      if (r.peptideCredits > 0 && r.membershipId) {
        await tx.membership.updateMany({
          where: { id: r.membershipId, freePeptidesUsedThisPeriod: { gte: r.peptideCredits } },
          data: { freePeptidesUsedThisPeriod: { decrement: r.peptideCredits } },
        })
      }
    })
  } catch (err) {
    console.error('[checkout] FAILED to release reserved credit/points — reconcile manually:', r, err)
  }
}

const checkoutSchema = z.object({
  // Whole units only (a fractional quantity priced lines at fractions of a
  // cent), and at least one line — same as checkout-zelle.
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1),
  })).min(1, 'Cart is empty'),
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
  // Throttle checkout attempts per IP — limits card-testing / order spam.
  const limited = checkRateLimit(req, 'checkout', { limit: 10, windowMs: 60_000 })
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  // Tracks a discount-code use we atomically claim below, so a failed checkout
  // can release it (see the catch).
  let claimedDiscountCodeId: string | null = null
  // Store credit / points debited before charging; released by the catch if
  // the order is never written.
  let reservation: Reservation = null

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
      if (!product) throw new UnorderableLineError(`Product ${item.productId} not found or inactive`)
      const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null
      // A variantId that isn't one of this product's variants used to fall
      // back to the product's base price and store the foreign variantId on
      // the line (wrong price, and mark-paid then took stock from that other
      // variant). Refuse it.
      if (item.variantId && !variant) {
        throw new UnorderableLineError(`The selected option for ${product.name} is no longer available`)
      }
      // A product sold in sizes must be ordered in a size; without one the
      // line was charged the product's own price, which can differ from every
      // size (Selank: $45 product price vs $74 for the only size sold).
      if (!item.variantId && product.variants.length > 0) {
        throw new UnorderableLineError(`Please choose a size for ${product.name}`)
      }
      const price = variant?.price ?? product.price
      // `??` falls back on null/undefined but NOT on 0, so a variant saved
      // without a price resolves to 0 and this line would be sold for nothing.
      // Refuse the order rather than charge $0 or silently substitute the
      // product price, which nobody set for this variant. Member freebies are
      // appended after this loop and are unaffected.
      if (!Number.isFinite(price) || price <= 0) {
        throw new UnorderableLineError(
          `No price set for ${product.name}${variant ? ` — ${variant.name}` : ''}`,
        )
      }
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

    // Member + bundle + peptide-credit pricing through the SINGLE engine, exactly
    // like checkout-zelle — so a member/bundle buyer is charged the same total the
    // cart showed. Previously this route only applied the discount code and
    // silently dropped the member %, the volume bundle discount, and free-peptide
    // credits (charging full price vs the discounted cart display).
    const membership = await prisma.membership.findUnique({
      where: { userId: session.user.id },
    })
    const priced = await computeCartTotal(
      data.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
      })),
      { userId: session.user.id },
    ).catch(() => null)
    const membershipDiscount = priced
      ? priced.member.discountCents +
        priced.bundle.discountCents +
        priced.member.creditDiscountCents
      : 0
    const peptideCreditsApplied = priced?.member.peptideCreditsApplied ?? 0

    // Discount code stacks on the post-membership amount. Claim one use atomically
    // up-front (conditional on usedCount < maxUses) so concurrent checkouts can't
    // redeem past the cap — the old read-then-increment let two orders both pass.
    let discount = membershipDiscount
    // Same rules + pricing as checkout-zelle (lib/checkout-discount.ts).
    const pricedCode = await priceDiscountCode(data.discountCode, {
      userId: session.user.id,
      subtotal,
      base: subtotal - membershipDiscount,
      items: data.items,
    })
    let codeFreeShipping = false
    if (pricedCode) {
      if (!(await claimDiscountCodeUse(pricedCode))) {
        throw new DiscountCodeError('Code usage limit reached')
      }
      claimedDiscountCodeId = pricedCode.id
      discount += pricedCode.amount
      codeFreeShipping = pricedCode.freeShipping
    }

    // Member free shipping (active Plus/Premium).
    const memberFreeShipping =
      !!membership &&
      membership.status === 'ACTIVE' &&
      (membership.tier === 'PLUS' || membership.tier === 'PREMIUM') &&
      TIER_BENEFITS[membership.tier].freeShipping
    const { rate: shippingCost } = memberFreeShipping || codeFreeShipping
      ? { rate: 0 }
      : await calculateShipping(
          subtotal,
          data.shippingAddress.country,
          data.shippingAddress.state,
        )

    // Preview how many points the user wants to redeem, clamped to their balance
    // AND the remaining amount after the discount so the total can't go negative.
    let plannedPointsRedeem = 0
    let plannedPointsDiscount = 0
    if (data.useLoyaltyPoints && data.useLoyaltyPoints > 0) {
      const acct = await prisma.loyaltyAccount.findUnique({
        where: { userId: session.user.id },
      })
      const available = acct?.points ?? 0
      const remainingAfterDiscount = Math.max(0, subtotal - discount)
      plannedPointsRedeem = Math.min(data.useLoyaltyPoints, available, await maxRedeemablePoints(remainingAfterDiscount))
      plannedPointsDiscount = pointsToDiscountCents(plannedPointsRedeem)
    }

    const taxableBase = Math.max(0, subtotal - discount - plannedPointsDiscount)
    const taxAmount = await calculateTaxAsync(taxableBase, data.shippingAddress.state, {
      organizationId,
    })

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

    // RESERVE the credit and points BEFORE charging: one conditional
    // UPDATE … WHERE balance >= n each, in one transaction. Previously both
    // were read here and debited with a read-then-write AFTER the order was
    // created, so simultaneous checkouts each took the full credit/points
    // discount and drove the balances negative (3 parallel orders against
    // $50 credit left it at -$76.72). A lost race now refuses with 409 before
    // any card is charged. The reservation is released if the payment fails
    // or the order cannot be written.
    const creditsToConsume = membership && peptideCreditsApplied > 0 ? peptideCreditsApplied : 0
    if (actualCreditUse > 0 || plannedPointsRedeem > 0 || creditsToConsume > 0) {
      await prisma.$transaction(async (tx) => {
        // Free-peptide credits too (conditional — see consumePeptideCredits).
        if (membership && creditsToConsume > 0) {
          await consumePeptideCredits(tx, {
            membershipId: membership.id,
            applied: creditsToConsume,
            creditsThisPeriod: membership.freePeptideCreditsThisPeriod,
          })
        }
        if (actualCreditUse > 0) {
          const { count } = await tx.storeCredit.updateMany({
            where: { userId: session.user.id, balance: { gte: actualCreditUse } },
            data: { balance: { decrement: actualCreditUse } },
          })
          if (count !== 1) throw new InsufficientCreditError()
        }
        if (plannedPointsRedeem > 0) {
          const { count } = await tx.loyaltyAccount.updateMany({
            where: { userId: session.user.id, points: { gte: plannedPointsRedeem } },
            data: { points: { decrement: plannedPointsRedeem } },
          })
          if (count !== 1) throw new InsufficientPointsError()
        }
      })
      reservation = {
        userId: session.user.id,
        credit: actualCreditUse,
        points: plannedPointsRedeem,
        peptideCredits: creditsToConsume,
        membershipId: membership?.id ?? null,
      }
    }

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
        // Payment failed — give back the reserved credit/points.
        await releaseReservation(reservation)
        reservation = null
        // Release the discount-code use we claimed before
        // charging, so a declined card doesn't permanently burn a use.
        if (claimedDiscountCodeId) {
          await prisma.discountCode
            .updateMany({
              where: { id: claimedDiscountCodeId, usedCount: { gt: 0 } },
              data: { usedCount: { decrement: 1 } },
            })
            .catch(() => {})
        }
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

    // The order and the ledger lines for the reserved credit/points are written
    // together; the balances themselves were already debited above.
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: session.user.id,
          email: data.email,
          subtotal,
          discount,
          shipping: shippingCost,
          tax: taxAmount,
          total,
          discountCode: normalizeDiscountCode(data.discountCode),
          paymentMethod: 'card',
          paymentStatus: 'PAID',
          paymentId: paymentTransactionId,
          status: 'PROCESSING',
          organizationId,
          locationId,
          clientId,
          salesChannel,
          shippingAddressId: shippingAddress?.id,
          storeCreditUsed: actualCreditUse,
          loyaltyPointsUsed: plannedPointsRedeem,
          items: { create: orderItems },
        },
      })
      if (actualCreditUse > 0) {
        const credit = await tx.storeCredit.findUniqueOrThrow({
          where: { userId: session.user.id },
          select: { id: true },
        })
        await tx.storeCreditTxn.create({
          data: {
            creditId: credit.id,
            type: 'CHECKOUT_APPLY',
            amount: -actualCreditUse,
            description: 'Applied at checkout',
            orderId: created.id,
          },
        })
      }
      if (plannedPointsRedeem > 0) {
        const acct = await tx.loyaltyAccount.findUniqueOrThrow({
          where: { userId: session.user.id },
          select: { id: true },
        })
        await tx.loyaltyTransaction.create({
          data: {
            accountId: acct.id,
            type: 'REDEEM_DISCOUNT',
            points: -plannedPointsRedeem,
            description: `Redeemed ${plannedPointsRedeem} points for $${(plannedPointsDiscount / 100).toFixed(2)} off`,
            orderId: created.id,
          },
        })
      }
      return created
    })
    // The reservation now belongs to the order.
    reservation = null

    // The discount-code use was claimed atomically up-front; clear the release
    // tracker so the catch won't roll it back now the order exists.
    claimedDiscountCodeId = null

    // Decrement inventory NOW — this order is created PAID/PROCESSING, so it never
    // traverses the mark-paid/PATCH path that decrements Zelle orders. Without
    // this, every card order left stock untouched and oversold.
    // Guarded so stock can never go below zero, and an oversell is logged
    // rather than silently written as a negative. See src/lib/inventory.ts.
    for (const item of orderItems) {
      await decrementStock(
        { variantId: item.variantId, productId: item.productId, quantity: item.quantity },
        'checkout',
      )
    }

    const pointsUsed = plannedPointsRedeem
    const creditApplied = actualCreditUse

    // Award loyalty points based on what the customer actually paid.
    const pointsEarned = await awardPointsForOrder({
      userId: session.user.id,
      orderId: order.id,
      orderTotal: total + creditApplied, // total + credit = taxed+shipped price, excluding points discount
    }).then((r) => r.pointsEarned).catch(() => 0)

    await prisma.order.update({
      where: { id: order.id },
      data: { loyaltyPointsEarned: pointsEarned },
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
      // Commission is paid on GROSS PRODUCT VALUE (subtotal), not the
      // post-discount/credit total — matches checkout-zelle + mark-paid so a
      // member whose credits zero the payable total still earns the location
      // a real cut. (Edward, 2026-06-12.)
      const commissionAmount = Math.round(subtotal * commissionRate)
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
      // Never pays an affiliate on their own order (lib/affiliate-tracking.ts).
      const affiliate = await resolveOrderAffiliate(affCode, { userId: session.user.id, email: data.email })
      if (affiliate) {
        // Gross subtotal, not post-discount/credit total — see comment above
        // and mark-paid (Edward, 2026-06-12).
        const commission = Math.round(subtotal * affiliate.commissionRate)
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
    if (reservation) {
      await releaseReservation(reservation)
      reservation = null
    }
    // Release a discount-code use claimed before the order was created (the
    // tracker is cleared once the order exists, so this only fires pre-order).
    if (claimedDiscountCodeId) {
      await prisma.discountCode
        .updateMany({
          where: { id: claimedDiscountCodeId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        })
        .catch(() => {})
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    if (error instanceof DiscountCodeError || error instanceof UnorderableLineError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (
      error instanceof InsufficientCreditError ||
      error instanceof InsufficientPointsError ||
      error instanceof PeptideCreditsChangedError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
