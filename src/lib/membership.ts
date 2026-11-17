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

/** Thrown when this cycle's free-peptide credits were used by another order meanwhile. */
export class PeptideCreditsChangedError extends Error {
  constructor() {
    super('Your member credits changed while you were checking out. Please review your order and place it again.')
    this.name = 'PeptideCreditsChangedError'
  }
}

type Tx = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/**
 * Use `applied` free-peptide credits, inside the order's transaction. One
 * conditional UPDATE (used + applied <= this cycle's allotment), so two
 * simultaneous orders can't both redeem the same credit. It was an
 * unconditional increment after the order was committed: one credit, three
 * parallel orders, three free peptides.
 */
export async function consumePeptideCredits(
  tx: Tx,
  args: { membershipId: string; applied: number; creditsThisPeriod: number },
): Promise<void> {
  const { membershipId, applied, creditsThisPeriod } = args
  if (!Number.isInteger(applied) || applied <= 0) return
  const { count } = await tx.membership.updateMany({
    where: {
      id: membershipId,
      status: 'ACTIVE',
      freePeptideCreditsThisPeriod: creditsThisPeriod,
      freePeptidesUsedThisPeriod: { lte: creditsThisPeriod - applied },
    },
    data: { freePeptidesUsedThisPeriod: { increment: applied } },
  })
  if (count !== 1) throw new PeptideCreditsChangedError()
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
