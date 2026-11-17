import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { awardPoints } from './points'
import { getEarningRule } from './earning'
import { normalizeMemberNumber } from './member-card'
import { globalUrl } from './links'
import { isUniqueViolation } from './rewards-errors'

/**
 * Member-gets-member referrals.
 *
 * The store's affiliate programme (cookie + commission on product orders) is
 * untouched: membership invoices never pay affiliates, and most members are
 * not affiliates. Instead every member's own member number is their referral
 * code: their link opens .global's existing membership signup with
 * `?ref=<member number>`, which the signup carries through registration and
 * hands to /api/membership/subscribe. That records a VipReferral (one per
 * referred person, first referrer wins, never yourself, never someone who
 * has already paid for a membership). When the admin marks the referred
 * person's FIRST membership invoice paid, the referrer receives the referral
 * award (`vip.points.referral`, default 2,500) exactly once
 * (key `referral:<referred user id>`).
 */

export function referralLink(memberNumber: string): string {
  return globalUrl(`/membership?ref=${encodeURIComponent(memberNumber)}&from=vip`)
}

/** Best-effort: called from membership signup. Never throws. */
export async function recordReferral(referredUserId: string, refInput: string | null | undefined): Promise<'recorded' | 'ignored'> {
  try {
    const code = normalizeMemberNumber(refInput)
    if (!code) return 'ignored'
    const card = await prisma.vipMemberCard.findUnique({ where: { memberNumber: code }, select: { userId: true } })
    if (!card || card.userId === referredUserId) return 'ignored'
    const m = await prisma.membership.findUnique({ where: { userId: referredUserId }, select: { paymentConfirmedAt: true } })
    if (m?.paymentConfirmedAt) return 'ignored' // already a paying member — not a new referral
    await prisma.vipReferral.create({ data: { referrerUserId: card.userId, referredUserId, code } })
    return 'recorded'
  } catch (e) {
    if (!isUniqueViolation(e)) console.error('[vip referral] record failed:', e)
    return 'ignored'
  }
}

/** Called from mark-paid on a membership's first activation. Exactly once per referred person. */
export async function awardReferralOnFirstPayment(referredUserId: string): Promise<{ awarded: number; referrerUserId: string | null }> {
  const ref = await prisma.vipReferral.findUnique({ where: { referredUserId } })
  if (!ref || ref.awardedAt) return { awarded: 0, referrerUserId: ref?.referrerUserId ?? null }
  const points = await getEarningRule('vip.points.referral')
  if (points <= 0) return { awarded: 0, referrerUserId: ref.referrerUserId }
  const r = await prisma.$transaction(async (tx) => {
    const claim = await tx.vipReferral.updateMany({ where: { id: ref.id, awardedAt: null }, data: { awardedAt: new Date() } })
    if (claim.count !== 1) return null
    const award = await awardPoints({
      tx,
      userId: ref.referrerUserId,
      points,
      type: 'EARN_REFERRAL',
      description: 'A member you referred joined',
      idempotencyKey: `referral:${referredUserId}`,
      source: 'vip:referral',
    })
    await tx.vipReferral.update({ where: { id: ref.id }, data: { awardTxnId: award.transactionId } })
    return award
  })
  if (!r) return { awarded: 0, referrerUserId: ref.referrerUserId }
  await logAudit({
    action: 'vip.referral.award',
    entityType: 'VipReferral',
    entityId: ref.id,
    metadata: { referrerUserId: ref.referrerUserId, referredUserId, points },
  })
  return { awarded: points, referrerUserId: ref.referrerUserId }
}
