import type { LoyaltyTxType, MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { pointsToCents } from './points'
import {
  EARNING_RULES,
  formatBps,
  formatMultiplier,
  getEarningRules,
  purchaseRateBps,
  tierMultiplierPct,
  type EarningKey,
  type EarningRuleDef,
  type EarningRules,
} from './earning'
import { formatMemberNumber, getOrCreateMemberCard } from './member-card'
import { pointsExpiryFor } from './points-expiry'
import { referralLink } from './referrals'
import { REWARD_BADGES, evaluateBadges } from './badges'

/**
 * Plain labels for the points history on .vip. Descriptions written by staff
 * or admins (an adjustment reason, a store order line) are never shown —
 * only these labels, plus reward titles and partner names, which the team
 * writes for the clubhouse.
 */
const TYPE_LABEL: Record<LoyaltyTxType, string> = {
  EARN_PURCHASE: 'Purchase at vitalityproject.global',
  EARN_REFERRAL: 'Referral — a member you invited joined',
  EARN_REVIEW: 'Review bonus',
  EARN_BIRTHDAY: 'Birthday bonus',
  EARN_ADMIN: 'Points from the Vitality team',
  REDEEM_DISCOUNT: 'Used at vitalityproject.global checkout',
  EXPIRE: 'Points expired after a period without activity',
  ADJUST: 'Adjustment by the Vitality team',
  EARN_ENGAGEMENT: 'Clubhouse activity',
  EARN_PARTNER: 'Purchase at a partner',
  REDEEM_REWARD: 'Reward redeemed',
  REDEEM_PARTNER: 'Spent at a partner',
  REVERSAL: 'Correction',
}

export function pointsLabel(t: { type: LoyaltyTxType; description: string; source: string | null; points: number }): string {
  // Reward titles and partner names are clubhouse-facing copy written by the team.
  if (t.type === 'REDEEM_REWARD' || t.type === 'EARN_PARTNER' || t.type === 'REDEEM_PARTNER') {
    return t.description.slice(0, 120) || TYPE_LABEL[t.type]
  }
  if (t.type === 'REVERSAL') {
    if (t.source === 'vip:rewards') return 'Points returned — reward cancelled'
    if (t.source?.startsWith('partner:')) return t.points > 0 ? 'Points returned — partner spend voided' : 'Partner purchase voided'
    return TYPE_LABEL.REVERSAL
  }
  if (t.type === 'EARN_ENGAGEMENT' && t.description && t.description.length <= 80) return t.description
  return TYPE_LABEL[t.type]
}

/**
 * The member "How to earn" table — built from the earning-rules registry
 * (lib/vip/earning.ts): every rule with a member label, in registry order, at
 * its live value. The admin Earning rules page edits the same list, so the
 * two can never drift. Rules set to 0 (off) are left out.
 */
export function earningTable(rules: EarningRules, tier: MembershipTier, partners: { name: string; earnPointsPerDollar: number }[]) {
  const rate = purchaseRateBps(tier === 'NONE' ? 'CLUB' : tier, rules)
  const rows: { key: string; action: string; points: string; note?: string }[] = []
  if (rate > 0) {
    rows.push({
      key: 'vip.points.purchaseBaseBps',
      action: 'Shop at vitalityproject.global',
      points: `${formatBps(rate)} back`,
      note: `${rate / 100} points per $1 on your level`,
    })
  }
  for (const r of EARNING_RULES as readonly EarningRuleDef[]) {
    if (!r.member) continue
    const value = rules[r.key as EarningKey]
    if (!value) continue
    rows.push({
      key: r.key,
      action: r.member,
      points: r.key === 'vip.points.challengeDefault' ? 'Varies' : `${value.toLocaleString('en-US')} pts`,
      ...(r.memberNote ? { note: r.memberNote } : {}),
    })
  }
  for (const p of partners) {
    if (p.earnPointsPerDollar > 0) rows.push({ key: `partner:${p.name}`, action: `Spend at ${p.name}`, points: `${p.earnPointsPerDollar} pts per $1` })
  }
  return rows
}

export async function getPointsHub(viewer: { userId: string; tier: MembershipTier }) {
  await evaluateBadges(viewer.userId).catch(() => {})
  const [acct, rules, card, expiry, partners, badges, txns, redemptionsOpen] = await Promise.all([
    prisma.loyaltyAccount.findUnique({ where: { userId: viewer.userId }, select: { id: true, points: true } }),
    getEarningRules(),
    getOrCreateMemberCard(viewer.userId),
    pointsExpiryFor(viewer.userId),
    prisma.vipPartner.findMany({ where: { active: true }, select: { name: true, earnPointsPerDollar: true }, orderBy: { name: 'asc' } }),
    prisma.vipUserBadge.findMany({ where: { userId: viewer.userId }, orderBy: { awardedAt: 'asc' } }),
    prisma.loyaltyTransaction.findMany({
      where: { account: { userId: viewer.userId } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true, type: true, points: true, description: true, source: true, createdAt: true },
    }),
    prisma.vipRedemption.count({ where: { userId: viewer.userId, status: { in: ['REQUESTED', 'APPROVED'] } } }),
  ])
  const points = acct?.points ?? 0
  const multiplierPct = tierMultiplierPct(viewer.tier, rules)
  const soon = expiry && expiry.expiresAt.getTime() - Date.now() < 60 * 86400e3 ? expiry : null
  const earnedKeys = new Set(badges.map((b) => b.badgeKey))
  return {
    points,
    valueCents: pointsToCents(points),
    tier: viewer.tier,
    tierLabel: TIER_BENEFITS[viewer.tier].label,
    multiplier: multiplierPct ? formatMultiplier(multiplierPct) : null,
    purchaseRate: formatBps(purchaseRateBps(viewer.tier === 'NONE' ? 'CLUB' : viewer.tier, rules)),
    memberNumber: formatMemberNumber(card.memberNumber),
    memberNumberRaw: card.memberNumber,
    referralLink: referralLink(card.memberNumber),
    referralPoints: rules['vip.points.referral'],
    expiry: expiry ? { expiresAt: expiry.expiresAt.toISOString(), months: expiry.months, soon: !!soon } : null,
    earning: earningTable(rules, viewer.tier, partners),
    badges: [
      ...REWARD_BADGES.map((b) => ({
        key: b.key,
        label: b.label,
        hint: b.hint,
        earned: earnedKeys.has(b.key),
        awardedAt: badges.find((x) => x.badgeKey === b.key)?.awardedAt.toISOString() ?? null,
      })),
      // Badges other clubhouse features award (workouts, community…).
      ...badges
        .filter((b) => !REWARD_BADGES.some((r) => r.key === b.badgeKey))
        .map((b) => ({ key: b.badgeKey, label: b.label, hint: '', earned: true, awardedAt: b.awardedAt.toISOString() })),
    ],
    history: txns.map((t) => ({
      id: t.id,
      points: t.points,
      label: pointsLabel(t),
      createdAt: t.createdAt.toISOString(),
    })),
    openRedemptions: redemptionsOpen,
  }
}
