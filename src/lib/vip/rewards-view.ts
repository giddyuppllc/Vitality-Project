import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import type { VipViewer } from './access'
import { getTierRewardSettings, periodFor, upcomingRewardExpiries, type RewardTier } from './rewards'
import { getVipSetting } from './settings'

/**
 * Plain-language ledger labels for the clubhouse. The raw StoreCreditTxn
 * description can carry store detail typed by an admin (a refund reason,
 * an order line) — the clubhouse shows these labels instead, so no product
 * wording ever reaches .vip.
 */
const LABELS: Record<string, string> = {
  MEMBER_REWARD: 'Monthly member reward',
  CHECKOUT_APPLY: 'Used at vitalityproject.global checkout',
  CHECKOUT_RESTORE: 'Returned from a cancelled order',
  REFUND: 'Refund credit',
  ADMIN_GRANT: 'Credit from the Vitality team',
  REFERRAL_BONUS: 'Referral bonus',
  BIRTHDAY: 'Birthday credit',
  LOYALTY_REDEEM: 'Loyalty points converted to credit',
  EXPIRE: 'Reward credit reached its expiry date',
}

export function ledgerLabel(type: string, description: string): string {
  if (type === 'MEMBER_REWARD') {
    const m = /\((.+), (\d{4})-(\d{2})\)$/.exec(description)
    if (m) {
      const month = new Date(Date.UTC(Number(m[2]), Number(m[3]) - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      return `Monthly member reward — ${m[1]}, ${month}`
    }
  }
  return LABELS[type] ?? 'Store credit'
}

/**
 * What the rewards page shows. Every number is read from existing data:
 *  - balance + history: the StoreCredit ledger (.global's own)
 *  - member discount / free shipping: TIER_BENEFITS, i.e. what .global checkout
 *    already applies. Product-specific perks are deliberately NOT shown — the
 *    clubhouse carries no product surface; members see those at .global.
 *  - monthly clubhouse grant: the admin setting (defaults Club $5 / Plus $20 /
 *    Premium Stacks $50; 0 = off → not shown)
 */
export async function getRewardsSummary(viewer: VipViewer) {
  const [credit, settings, thisMonth, expiries, expiryMonths] = await Promise.all([
    prisma.storeCredit.findUnique({
      where: { userId: viewer.userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
    }),
    getTierRewardSettings(),
    prisma.vipRewardGrant.findUnique({
      where: { userId_period: { userId: viewer.userId, period: periodFor(new Date()) } },
    }),
    upcomingRewardExpiries(viewer.userId),
    getVipSetting('vip.rewardExpiryMonths'),
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
      label: ledgerLabel(t.type, t.description),
      createdAt: t.createdAt.toISOString(),
    })),
    storePerks: {
      memberDiscountPct: benefits.permanentDiscountPct,
      freeShipping: benefits.freeShipping,
    },
    monthlyGrantCents: viewer.tier === 'NONE' ? 0 : settings[viewer.tier as RewardTier],
    grantedThisMonth: !!thisMonth,
    expiryMonths,
    expiries: expiries.map((e) => ({ cents: e.cents, issuedAt: e.issuedAt.toISOString(), expiresAt: e.expiresAt.toISOString() })),
  }
}
