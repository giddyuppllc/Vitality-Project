import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import type { VipViewer } from './access'
import { getTierRewardSettings, periodFor, type RewardTier } from './rewards'

/**
 * What the rewards page shows. Every number is read from existing data:
 *  - balance + history: the StoreCredit ledger (.global's own)
 *  - member discount / free shipping: TIER_BENEFITS, i.e. what .global checkout
 *    already applies. Product-specific perks (per-product credits, supplies)
 *    are deliberately NOT shown here — the clubhouse carries no product surface;
 *    members see those at .global.
 *  - monthly clubhouse grant: the admin setting (0 = off → not shown)
 */
export async function getRewardsSummary(viewer: VipViewer) {
  const [credit, settings, thisMonth] = await Promise.all([
    prisma.storeCredit.findUnique({
      where: { userId: viewer.userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
    }),
    getTierRewardSettings(),
    prisma.vipRewardGrant.findUnique({
      where: { userId_period: { userId: viewer.userId, period: periodFor(new Date()) } },
    }),
  ])
  const benefits = TIER_BENEFITS[viewer.tier]
  return {
    tier: viewer.tier,
    tierLabel: benefits.label,
    balanceCents: credit?.balance ?? 0,
    history: (credit?.transactions ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amountCents: t.amount,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
    storePerks: {
      memberDiscountPct: benefits.permanentDiscountPct,
      freeShipping: benefits.freeShipping,
    },
    monthlyGrantCents: viewer.tier === 'NONE' ? 0 : settings[viewer.tier as RewardTier],
    grantedThisMonth: !!thisMonth,
  }
}
