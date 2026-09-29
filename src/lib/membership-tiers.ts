// Pure data (no prisma import) so client components can read tier labels.
// Re-exported unchanged from lib/membership.ts.
/**
 * Membership tier benefits — single source of truth.
 * Used at checkout to apply discounts and freebies.
 */
export const TIER_BENEFITS = {
  NONE: {
    monthlyPriceCents: 0,
    permanentDiscountPct: 0,
    freePeptideCreditsPerPeriod: 0,
    freeBacAndSyringes: false,
    freeShipping: false,
    label: 'Guest',
  },
  CLUB: {
    monthlyPriceCents: 2500,
    permanentDiscountPct: 5,
    freePeptideCreditsPerPeriod: 0,
    freeBacAndSyringes: false,
    freeShipping: false,
    label: 'The Club',
  },
  PLUS: {
    monthlyPriceCents: 15000,
    permanentDiscountPct: 10,
    freePeptideCreditsPerPeriod: 1,
    freeBacAndSyringes: true,
    freeShipping: true,
    label: 'Plus',
  },
  PREMIUM: {
    monthlyPriceCents: 25000,
    permanentDiscountPct: 15,
    freePeptideCreditsPerPeriod: 3,
    freeBacAndSyringes: true,
    freeShipping: true,
    label: 'Premium Stacks',
  },
} as const
