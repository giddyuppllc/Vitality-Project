import { prisma } from '@/lib/prisma'
import type { MembershipTier } from '@prisma/client'

export { TIER_BENEFITS } from './membership-tiers'
import { TIER_BENEFITS } from './membership-tiers'

/**
 * Returns the tier + benefits for a given user. NONE if no active membership.
 */
export async function getUserMembership(userId: string) {
  const m = await prisma.membership.findUnique({ where: { userId } })
  const tier: MembershipTier = m && m.status === 'ACTIVE' ? m.tier : 'NONE'
  return {
    tier,
    membership: m,
    benefits: TIER_BENEFITS[tier],
  }
}

/**
 * Calculates the member discount on a subtotal.
 */
export function calculateMemberDiscount(subtotal: number, tier: MembershipTier): number {
  const pct = TIER_BENEFITS[tier].permanentDiscountPct
  return Math.round(subtotal * (pct / 100))
}

/**
 * Maps the public plan id from /membership page to the schema tier.
 */
export function planIdToTier(planId: string): MembershipTier {
  switch (planId) {
    case 'club':
    case 'monthly':  // legacy
      return 'CLUB'
    case 'plus':
    case 'quarterly':  // legacy
      return 'PLUS'
    case 'premium':
    case 'annual':  // legacy
      return 'PREMIUM'
    default:
      return 'NONE'
  }
}
