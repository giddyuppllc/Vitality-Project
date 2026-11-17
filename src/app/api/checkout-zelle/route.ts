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
  orderConfirmation,
} from '@/lib/email-templates'
import { calculateShipping } from '@/lib/shipping'
import { calculateTaxAsync } from '@/lib/tax'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { computeCartTotal, UnorderableLineError } from '@/lib/pricing'
import { TIER_BENEFITS } from '@/lib/membership'
import {
  InsufficientCreditError,
  plannedCreditUse,
  spendCreditForOrder,
} from '@/lib/order-credit'
import { InsufficientPointsError, redeemPointsInTx } from '@/lib/loyalty'
import { resolveOrderAffiliate } from '@/lib/affiliate-tracking'
import {
  claimDiscountCodeUse,
  DiscountCodeError,
  normalizeDiscountCode,
  priceDiscountCode,
} from '@/lib/checkout-discount'
import { z } from 'zod'

// Shared system user that owns guest shipping-address rows (Address.userId is a
// required FK). Guest ORDERS themselves stay userId:null with the real customer
// email on the order — this user only anchors the address snapshot.
async function getOrCreateGuestUserId(): Promise<string> {
  const guest = await prisma.user.upsert({
    where: { email: 'guest-orders@vitalityproject.global' },
    update: {},
    create: { email: 'guest-orders@vitalityproject.global', name: 'Guest Orders' },
  })
  return guest.id
}

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
  // Spend available store credit (monthly clubhouse rewards, refunds, grants)
  // against this order. On by default for signed-in customers; the checkout
  // shows a toggle. Guests and tenant/B2B orders never spend credit.
  useStoreCredit: z.boolean().optional().default(true),
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
  // Throttle order placement per IP — limits order spam.
  const limited = checkRateLimit(req, 'checkout-zelle', { limit: 10, windowMs: 60_000 })
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  // Tracks a discount-code use we atomically claimed below, so we can release it
  // if the order ultimately fails to be created (see the catch at the bottom).
  let claimedDiscountCodeId: string | null = null

  try {
    const session = await getServerSession(authOptions)
    // Guest checkout allowed: no session → the order is a true guest order
    // (userId null, real email on the order). Only the shipping Address row needs
    // an owner, so guest addresses are parented to a system "guest orders" user.
    const userId = session?.user?.id ?? null

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
      const client = userId
        ? await prisma.orgClient.findUnique({
            where: {
              organizationId_userId: { organizationId: org.id, userId },
            },
          })
        : null
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
        throw new UnorderableLineError(`Product ${item.productId} not found or inactive`)
      }
      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : null
      // A variantId that isn't one of this product's variants used to fall
      // back to the product's base price and store the foreign variantId on
      // the line (wrong price, and mark-paid then took stock from that other
      // variant). Refuse it.
      if (item.variantId && !variant) {
        throw new UnorderableLineError(`The selected option for ${product.name} is no longer available`)
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

    // Membership pricing — run the cart through the single pricing engine so
    // the member discount, bundle discount, and peptide credits all reach the
    // REAL order (the inline subtotal above doesn't know about them).
    const membership = userId
      ? await prisma.membership.findUnique({ where: { userId } })
      : null
    // Price through the single engine for EVERYONE, including guests. The cart
    // display (/api/cart) runs computeCartTotal with a null userId and shows the
    // bundle discount to anonymous shoppers, so the order MUST too. Previously
    // `priced` was gated on `userId`, so guest orders silently dropped the bundle
    // discount and charged full price while the cart showed it discounted — a
    // display != charge overcharge on every guest bundle order. Member and
    // peptide-credit discounts stay zero for guests (they require a userId).
    const priced = await computeCartTotal(
      data.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
      })),
      { userId: userId ?? null },
    ).catch(() => null)
    const membershipDiscount = priced
      ? priced.member.discountCents +
        priced.bundle.discountCents +
        priced.member.creditDiscountCents
      : 0
    const peptideCreditsApplied = priced?.member.peptideCreditsApplied ?? 0

    let discount = membershipDiscount
    // Every rule set on the code is enforced (lib/checkout-discount.ts); a code
    // that exists but doesn't apply is refused with its reason (400) instead
    // of being silently dropped or misapplied. Unknown codes (e.g. affiliate
    // codes typed into the same box) are not an error.
    const pricedCode = await priceDiscountCode(data.discountCode, {
      userId,
      subtotal,
      // Stacks on the post-membership amount so it never over-discounts.
      base: subtotal - membershipDiscount,
      items: data.items,
    })
    let codeFreeShipping = false
    if (pricedCode) {
      // Atomically CLAIM one use BEFORE applying the discount (conditional on
      // usedCount < maxUses), so concurrent checkouts can't redeem past the cap.
      if (!(await claimDiscountCodeUse(pricedCode))) {
        throw new DiscountCodeError('Code usage limit reached')
      }
      claimedDiscountCodeId = pricedCode.id
      discount += pricedCode.amount
      codeFreeShipping = pricedCode.freeShipping
    }

    // Loyalty redemption — validate balance and convert to discount cents.
    // 1 point = 1 cent. The redemption is applied AFTER discount-code discount
    // but BEFORE shipping/tax so points reduce the taxable base too. The
    // actual ledger mutation happens after the Order row is created so we
    // can pass orderId into redeemPointsForOrder.
    let loyaltyPointsToUse = 0
    let loyaltyDiscount = 0
    if (
      userId && // guests have no loyalty account
      data.loyaltyPointsToRedeem &&
      data.loyaltyPointsToRedeem > 0 &&
      !locationId // never redeem on B2B tenant orders
    ) {
      const account = await prisma.loyaltyAccount.findUnique({
        where: { userId },
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

    const memberFreeShipping =
      !!membership &&
      membership.status === 'ACTIVE' &&
      (membership.tier === 'PLUS' || membership.tier === 'PREMIUM') &&
      TIER_BENEFITS[membership.tier].freeShipping
    const shippingCost = memberFreeShipping || codeFreeShipping
      ? 0
      : (
          await calculateShipping(
            subtotal,
            data.shippingAddress.country,
            data.shippingAddress.state,
          )
        ).rate
    const taxableBase = Math.max(0, subtotal - discount - loyaltyDiscount)
    const taxAmount = await calculateTaxAsync(
      taxableBase,
      data.shippingAddress.state,
      { organizationId },
    )
    const preCreditTotal = Math.max(
      0,
      subtotal - discount - loyaltyDiscount + shippingCost + taxAmount,
    )
    // Store credit covers the order after discounts, shipping and tax — the
    // same base the card checkout uses. It is debited atomically with the
    // order row below (lib/order-credit.ts); Zelle is due on the remainder.
    const creditToUse =
      userId && data.useStoreCredit && !locationId
        ? await plannedCreditUse(userId, preCreditTotal)
        : 0
    const total = preCreditTotal - creditToUse

    // Free BAC + syringes — auto-added as $0 line items on EVERY order for
    // active Plus/Premium members (no per-cycle limit; members only).
    const suppliesEligible =
      !!membership &&
      membership.status === 'ACTIVE' &&
      (membership.tier === 'PLUS' || membership.tier === 'PREMIUM') &&
      TIER_BENEFITS[membership.tier].freeBacAndSyringes
    if (suppliesEligible) {
      const freebies = await prisma.product.findMany({
        where: {
          slug: { in: ['bacteriostatic-water', 'insulin-syringes'] },
          status: 'ACTIVE',
        },
        select: { id: true, name: true, sku: true },
      })
      for (const f of freebies) {
        orderItems.push({
          productId: f.id,
          variantId: undefined,
          name: `${f.name} — member freebie`,
          sku: f.sku ?? undefined,
          price: 0,
          quantity: 1,
          total: 0,
        })
      }
    }

    const orderNumber = generateOrderNumber()

    const addressData = {
      name: data.shippingAddress.name,
      line1: data.shippingAddress.line1,
      line2: data.shippingAddress.line2,
      city: data.shippingAddress.city,
      state: data.shippingAddress.state,
      zip: data.shippingAddress.zip,
      country: data.shippingAddress.country,
    }
    const shippingAddress = userId
      ? // Logged-in: reuse a matching saved address or create one they own.
        ((await prisma.address.findFirst({
          where: { userId, line1: addressData.line1, zip: addressData.zip },
        })) ??
          (await prisma.address
            .create({ data: { userId, ...addressData } })
            .catch(() => null)))
      : // Guest: store the shipping snapshot under the system guest user (the
        // order itself stays userId:null with the real email).
        await prisma.address
          .create({ data: { userId: await getOrCreateGuestUserId(), ...addressData } })
          .catch(() => null)

    // Pull the affiliate cookie (set by /r/<code>, /ref/<code>, or /api/affiliate/track)
    // and resolve it to an active Affiliate. Skipped for tenant/B2B traffic where
    // the location already owns the commission split.
    const affCode = req.cookies.get('aff_code')?.value
    let resolvedAffiliateId: string | null = null
    let resolvedAffiliateCode: string | null = null
    // An affiliate never earns on their own order (lib/affiliate-tracking.ts).
    const buyer = { userId, email: data.email }
    if (affCode && !locationId) {
      const aff = await resolveOrderAffiliate(affCode, buyer)
      if (aff) {
        resolvedAffiliateId = aff.id
        resolvedAffiliateCode = aff.code
      }
    }

    // Fallback attribution: no referral-link cookie, but the customer TYPED an
    // affiliate's code into the discount field (the common case — affiliates
    // share their code, not a link). Trim + uppercase so a stray space doesn't
    // silently drop the attribution. The code can double as a discount or not.
    if (!resolvedAffiliateId && !locationId && data.discountCode) {
      const aff = await resolveOrderAffiliate(data.discountCode, buyer)
      if (aff) {
        resolvedAffiliateId = aff.id
        resolvedAffiliateCode = aff.code
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        email: data.email,
        subtotal,
        discount,
        shipping: shippingCost,
        tax: taxAmount,
        total,
        // Canonical upper-case form, so uses-per-customer counts every use.
        discountCode: normalizeDiscountCode(data.discountCode),
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
        storeCreditUsed: creditToUse,
        items: { create: orderItems },
      },
      })
      if (creditToUse > 0 && userId) {
        await spendCreditForOrder(tx, {
          userId,
          orderId: created.id,
          orderNumber: created.orderNumber,
          amountCents: creditToUse,
        })
      }
      // Points are burned in the same transaction, with a conditional
      // decrement: if a simultaneous order already spent them, this order is
      // refused (409) and rolled back instead of keeping a discount nobody
      // paid for. (Was a read-then-write after the order was committed, so
      // parallel orders each got the full points discount and the balance
      // went negative.)
      if (loyaltyPointsToUse > 0 && userId) {
        await redeemPointsInTx(tx, {
          userId,
          points: loyaltyPointsToUse,
          orderId: created.id,
        })
      }
      return created
    })

    // Mark this visitor's referral click(s) as converted so the affiliate's
    // dashboard "Converted" column reflects reality (was permanently "No",
    // making affiliates think tracking was broken). Best-effort, session-scoped.
    if (resolvedAffiliateId) {
      const clickSessionId = req.cookies.get('session_id')?.value
      if (clickSessionId) {
        prisma.affiliateClick
          .updateMany({
            where: { affiliateId: resolvedAffiliateId, sessionId: clickSessionId, converted: false },
            data: { converted: true },
          })
          .catch(() => {})
      }
    }

    // The discount-code use was already claimed atomically up-front (before the
    // discount was applied), so there's nothing to increment here. Clearing the
    // release tracker means the catch below won't roll it back now the order
    // exists.
    claimedDiscountCodeId = null

    // Consume this cycle's peptide credits now that the order row exists.
    // (BAC + syringes are free on every order, so there's nothing to decrement.)
    if (membership && peptideCreditsApplied > 0) {
      await prisma.membership
        .update({
          where: { id: membership.id },
          data: { freePeptidesUsedThisPeriod: { increment: peptideCreditsApplied } },
        })
        .catch((err) =>
          console.error('[checkout-zelle] credit decrement failed:', err),
        )
    }

    // Clear server-side cart_items for this user so the abandoned-cart cron
    // doesn't pester them while they're still mid-Zelle-transfer. Best-effort
    // — failure here doesn't break the order.
    if (userId) {
      await prisma.cartItem
        .deleteMany({ where: { userId } })
        .catch((err) => console.error('[checkout-zelle] cart clear failed:', err))
    }

    const zelleConfig = await getZelleConfig()
    const customerName =
      data.shippingAddress.name || session?.user?.name || 'there'

    // Credits/membership can take the total to $0 — there's nothing to Zelle,
    // so send a plain order confirmation instead of payment instructions.
    const isFree = total <= 0

    void (async () => {
      try {
        if (isFree) {
          const conf = orderConfirmation({
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
          })
          await sendEmail({
            to: data.email,
            subject: conf.subject,
            html: conf.html,
            text: conf.text,
          })
        } else {
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
            storeCreditUsed: creditToUse,
          })
          await sendEmail({
            to: data.email,
            subject: instructions.subject,
            html: instructions.html,
            text: instructions.text,
          })
        }

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
            subject: isFree
              ? `[Free member order] #${order.orderNumber} — ready to ship`
              : alert.subject,
            html: alert.html,
            text: alert.text,
          })
        }

        // Text the business owner — Zelle orders need a manual "mark paid";
        // free member orders just need shipping.
        void sendOwnerSms(
          isFree
            ? `Vitality: free member order ${order.orderNumber} from ${customerName} ($0 — covered by credits). Mark paid in admin to release shipping.`
            : `Vitality: new Zelle order ${order.orderNumber} — ${formatPrice(total)} from ${customerName}. Awaiting payment; mark paid in admin when funds land.`,
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
      storeCreditUsed: creditToUse,
      zelleEmail: zelleConfig.email,
      paymentMethod: 'zelle',
      paymentStatus: 'UNPAID',
    })
  } catch (error) {
    console.error('[checkout-zelle] error:', error)
    // We claimed a discount-code use before the order was created; since the
    // order failed, release it so an errored checkout doesn't burn a use.
    if (claimedDiscountCodeId) {
      await prisma.discountCode
        .updateMany({
          where: { id: claimedDiscountCodeId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        })
        .catch((e) => console.error('[checkout-zelle] discount release failed:', e))
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      )
    }
    if (error instanceof DiscountCodeError || error instanceof UnorderableLineError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof InsufficientCreditError || error instanceof InsufficientPointsError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 },
    )
  }
}
