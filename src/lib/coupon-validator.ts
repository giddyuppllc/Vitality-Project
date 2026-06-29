import { prisma } from './prisma'

export interface ValidateCouponContext {
  userId?: string
  subtotal: number
  productIds: string[]
  categoryIds: string[]
}

export interface ValidateCouponResult {
  valid: boolean
  discount: number
  error?: string
  freeShipping?: boolean
  code?: string
  type?: string
}

/**
 * Validates a coupon code against a cart context.
 *
 * Checks:
 *   - code exists + active
 *   - not expired
 *   - under max uses
 *   - rule: min order, product match, category match, new customers only,
 *     members only, tier required, first-purchase only, uses per customer
 *
 * Returns the calculated discount amount (cents) plus freeShipping flag, or
 * an error message.
 */
export async function validateCoupon(
  code: string,
  context: ValidateCouponContext,
): Promise<ValidateCouponResult> {
  if (!code) return { valid: false, discount: 0, error: 'No code provided' }

  const normalized = code.trim().toUpperCase()

  const discountCode = await prisma.discountCode.findUnique({
    where: { code: normalized },
    include: { rule: true },
  })

  if (!discountCode) return { valid: false, discount: 0, error: 'Invalid code' }
  if (!discountCode.active)
    return { valid: false, discount: 0, error: 'Code is inactive' }
  if (discountCode.expiresAt && discountCode.expiresAt < new Date())
    return { valid: false, discount: 0, error: 'Code has expired' }
  if (
    discountCode.maxUses != null &&
    discountCode.usedCount >= discountCode.maxUses
  )
    return { valid: false, discount: 0, error: 'Code usage limit reached' }

  // Base-level min order
  if (discountCode.minOrder && context.subtotal < discountCode.minOrder) {
    return {
      valid: false,
      discount: 0,
      error: `Order must be at least $${(discountCode.minOrder / 100).toFixed(2)}`,
    }
  }

  const rule = discountCode.rule

  if (rule) {
    // Rule-level min
    if (rule.minOrderCents && context.subtotal < rule.minOrderCents) {
      return {
        valid: false,
        discount: 0,
        error: `Order must be at least $${(rule.minOrderCents / 100).toFixed(2)}`,
      }
    }

    // Product restriction — at least one cart product must be in the list
    if (rule.productIds.length > 0) {
      const anyMatch = context.productIds.some((id) =>
        rule.productIds.includes(id),
      )
      if (!anyMatch)
        return {
          valid: false,
          discount: 0,
          error: 'Code not valid for these products',
        }
    }

    // Category restriction
    if (rule.categoryIds.length > 0) {
      const anyMatch = context.categoryIds.some((id) =>
        rule.categoryIds.includes(id),
      )
      if (!anyMatch)
        return {
          valid: false,
          discount: 0,
          error: 'Code not valid for these categories',
        }
    }

    // Specific customer list
    if (rule.customerIds.length > 0) {
      if (!context.userId || !rule.customerIds.includes(context.userId))
        return {
          valid: false,
          discount: 0,
          error: 'Code not valid for your account',
        }
    }

    // New customers only — user has NO paid orders
    if (rule.newCustomersOnly) {
      if (!context.userId)
        return {
          valid: false,
          discount: 0,
          error: 'Sign in — code is for new customers',
        }
      const priorOrder = await prisma.order.findFirst({
        where: { userId: context.userId, paymentStatus: 'PAID' },
        select: { id: true },
      })
      if (priorOrder)
        return {
          valid: false,
          discount: 0,
          error: 'Code only valid for new customers',
        }
    }

    // First purchase only — alias of newCustomersOnly from a different angle
    if (rule.firstPurchaseOnly) {
      if (!context.userId)
        return {
          valid: false,
          discount: 0,
          error: 'Sign in — code is for first purchases',
        }
      const paidOrders = await prisma.order.count({
        where: { userId: context.userId, paymentStatus: 'PAID' },
      })
      if (paidOrders > 0)
        return {
          valid: false,
          discount: 0,
          error: 'Code only valid on first purchase',
        }
    }

    // Members only
    if (rule.membersOnly) {
      if (!context.userId)
        return { valid: false, discount: 0, error: 'Members-only code' }
      const membership = await prisma.loyaltyAccount.findUnique({
        where: { userId: context.userId },
      })
      if (!membership)
        return { valid: false, discount: 0, error: 'Members-only code' }
    }

    // Tier requirement
    if (rule.tierRequired) {
      if (!context.userId)
        return { valid: false, discount: 0, error: 'Tier-restricted code' }
      const account = await prisma.loyaltyAccount.findUnique({
        where: { userId: context.userId },
      })
      const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
      const userTierIdx = account ? tierOrder.indexOf(account.tier) : -1
      const requiredIdx = tierOrder.indexOf(rule.tierRequired)
      if (userTierIdx < requiredIdx)
        return {
          valid: false,
          discount: 0,
          error: `${rule.tierRequired} tier or higher required`,
        }
    }

    // Uses per customer
    if (rule.usesPerCustomer != null && context.userId) {
      const priorUses = await prisma.order.count({
        where: {
          userId: context.userId,
          discountCode: discountCode.code,
          status: { not: 'CANCELLED' }, // a cancelled order shouldn't burn the per-customer use
        },
      })
      if (priorUses >= rule.usesPerCustomer)
        return {
          valid: false,
          discount: 0,
          error: 'You have already used this code',
        }
    }
  }

  // Calculate discount
  let discount = 0
  let freeShipping = false

  switch (discountCode.type) {
    case 'PERCENTAGE':
      discount = Math.round(context.subtotal * (discountCode.value / 100))
      break
    case 'FIXED':
      discount = Math.min(discountCode.value, context.subtotal)
      break
    case 'FREE_SHIPPING':
      freeShipping = true
      discount = 0
      break
    case 'BOGO':
      // Buy-one-get-one: 50% off if 2+ items, capped at subtotal/2
      discount = Math.round(context.subtotal / 2)
      break
  }

  return {
    valid: true,
    discount,
    freeShipping,
    code: discountCode.code,
    type: discountCode.type,
  }
}
