import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { VipPartner, VipPartnerTxn } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserMembership } from '@/lib/membership'
import { logAudit } from '@/lib/audit'
import { awardPoints, spendPoints, InsufficientPointsError } from './points'
import { findUserIdByMemberNumber, formatMemberNumber, getOrCreateMemberCard } from './member-card'
import { partnerEarnPoints } from './earning'
import { RewardsError, isUniqueViolation } from './rewards-errors'
import { EARN_REVERSAL_PREFIX, evaluateBadges } from './badges'
import { periodFor } from './rewards'

/**
 * The partner network: Kevin's other businesses take part in the points
 * economy. Staff (VipPartnerStaff — existing users linked to a partner, no
 * new UserRole) use the portal on .vip to:
 *
 *  - record a member's purchase → points (EARN_PARTNER, source
 *    "partner:<slug>"), exactly once per receipt number per partner;
 *  - spend a member's points at the partner (REDEEM_PARTNER) — only with the
 *    one-time code the member generates in their own app for that partner
 *    and amount, so staff can never spend a balance on their own;
 *  - void either within 24 hours (REVERSAL), exactly once.
 *
 * Every action is checked against the staff member's OWN partner: a staff
 * login for one partner cannot touch another's members, receipts or
 * transactions.
 */

export const VOID_WINDOW_MS = 24 * 3600e3
export const CODE_TTL_MS = 10 * 60e3
export const CODE_MAX_ATTEMPTS = 5

export interface StaffContext {
  userId: string
  partner: VipPartner
  role: string
}

/** Partners this user may act for (active staff row on an active partner). */
export async function staffPartners(userId: string) {
  const rows = await prisma.vipPartnerStaff.findMany({
    where: { userId, active: true, partner: { active: true } },
    include: { partner: true },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((r) => ({ partner: r.partner, role: r.role }))
}

/** Resolve the staff member's partner; refuses any partner they don't work for. */
export async function requireStaffFor(userId: string, partnerId: string | null | undefined): Promise<StaffContext> {
  const mine = await staffPartners(userId)
  if (!mine.length) throw new RewardsError('not_partner_staff', 'This account is not set up for a partner business.', 403)
  const pick = partnerId ? mine.find((m) => m.partner.id === partnerId) : mine.length === 1 ? mine[0] : null
  if (!pick) throw new RewardsError('wrong_partner', 'You are not staff at that partner.', 403)
  return { userId, partner: pick.partner, role: pick.role }
}

function shortName(u: { name: string | null; username: string | null; vipProfile: { displayName: string | null } | null }) {
  const full = (u.vipProfile?.displayName || u.name || u.username || 'Member').trim()
  const parts = full.split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
}

/** What staff see about a member: first name + initial, level, whether they can earn/spend. No email, no balance. */
export async function lookupMember(staff: StaffContext, memberNumberInput: string) {
  const userId = await findUserIdByMemberNumber(memberNumberInput)
  if (!userId) throw new RewardsError('member_not_found', 'No member with that number. Check the digits and try again.', 404)
  const [user, { tier }, card] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, username: true, vipProfile: { select: { displayName: true } } } }),
    getUserMembership(userId),
    getOrCreateMemberCard(userId),
  ])
  const recent = await prisma.vipPartnerTxn.findMany({
    where: { partnerId: staff.partner.id, memberUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  return {
    memberNumber: formatMemberNumber(card.memberNumber),
    name: shortName(user),
    active: tier !== 'NONE',
    tier,
    canRedeemHere: staff.partner.allowRedemption && tier !== 'NONE',
    recent: recent.map(publicTxn),
  }
}

export function publicTxn(t: VipPartnerTxn) {
  return {
    id: t.id,
    kind: t.kind,
    amountCents: t.amountCents,
    points: t.points,
    receiptRef: t.receiptRef,
    createdAt: t.createdAt.toISOString(),
    voidedAt: t.voidedAt?.toISOString() ?? null,
    voidable: !t.voidedAt && Date.now() - t.createdAt.getTime() < VOID_WINDOW_MS,
  }
}

async function activeMemberId(memberNumberInput: string): Promise<string> {
  const userId = await findUserIdByMemberNumber(memberNumberInput)
  if (!userId) throw new RewardsError('member_not_found', 'No member with that number.', 404)
  const { tier } = await getUserMembership(userId)
  if (tier === 'NONE') throw new RewardsError('membership_inactive', 'This membership is not active, so points can’t be used right now.', 409)
  return userId
}

/** Purchase → points. Exactly once per (partner, receipt). */
export async function recordPurchase(
  staff: StaffContext,
  input: { memberNumber: string; amountCents: number; receiptRef: string },
): Promise<{ txn: VipPartnerTxn; duplicate: boolean }> {
  const receiptRef = input.receiptRef.trim()
  if (!receiptRef || receiptRef.length > 64) throw new RewardsError('receipt_required', 'Enter the receipt number.', 400)
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 10_000_000) {
    throw new RewardsError('bad_amount', 'Enter the purchase amount.', 400)
  }
  const prior = await prisma.vipPartnerTxn.findUnique({ where: { partnerId_receiptRef: { partnerId: staff.partner.id, receiptRef } } })
  if (prior) return { txn: prior, duplicate: true }

  const memberUserId = await activeMemberId(input.memberNumber)
  const points = partnerEarnPoints(input.amountCents, staff.partner.earnPointsPerDollar)
  if (points <= 0) throw new RewardsError('no_points', 'This purchase is too small to earn points.', 400)

  try {
    const txn = await prisma.$transaction(async (tx) => {
      const award = await awardPoints({
        tx,
        userId: memberUserId,
        points,
        type: 'EARN_PARTNER',
        description: `Purchase at ${staff.partner.name}`,
        idempotencyKey: `partner-earn:${staff.partner.id}:${receiptRef}`,
        source: `partner:${staff.partner.slug}`,
      })
      return tx.vipPartnerTxn.create({
        data: {
          partnerId: staff.partner.id,
          memberUserId,
          staffUserId: staff.userId,
          kind: 'EARN',
          amountCents: input.amountCents,
          points,
          receiptRef,
          ledgerTxnId: award.transactionId,
        },
      })
    })
    await logAudit({
      userId: staff.userId,
      action: 'vip.partner.earn',
      entityType: 'VipPartnerTxn',
      entityId: txn.id,
      metadata: { partner: staff.partner.slug, memberUserId, amountCents: input.amountCents, points, receiptRef },
    })
    await evaluateBadges(memberUserId).catch(() => {})
    return { txn, duplicate: false }
  } catch (e) {
    if (isUniqueViolation(e)) {
      const row = await prisma.vipPartnerTxn.findUnique({ where: { partnerId_receiptRef: { partnerId: staff.partner.id, receiptRef } } })
      if (row) return { txn: row, duplicate: true }
    }
    throw e
  }
}

const hashCode = (codeId: string, code: string) => createHash('sha256').update(`${codeId}:${code}`).digest('hex')

/**
 * Member side: a 6-digit code authorising `points` at one partner, valid 10
 * minutes, single use. A new code for the same partner replaces any earlier
 * unused one.
 */
export async function createRedeemCode(input: { userId: string; partnerId: string; points: number }) {
  const partner = await prisma.vipPartner.findUnique({ where: { id: input.partnerId } })
  if (!partner || !partner.active) throw new RewardsError('not_found', 'That partner is not in the network.', 404)
  if (!partner.allowRedemption) throw new RewardsError('redeem_off', `Points can’t be spent at ${partner.name} yet.`, 409)
  if (!Number.isInteger(input.points) || input.points < 100 || input.points > 10_000_000) {
    throw new RewardsError('bad_amount', 'Choose at least 100 points ($1).', 400)
  }
  const acct = await prisma.loyaltyAccount.findUnique({ where: { userId: input.userId }, select: { points: true } })
  if ((acct?.points ?? 0) < input.points) throw new RewardsError('not_enough_points', 'You don’t have that many points.', 409)

  const now = new Date()
  await prisma.vipPartnerRedeemCode.updateMany({
    where: { userId: input.userId, partnerId: partner.id, usedAt: null, expiresAt: { gt: now } },
    data: { expiresAt: now },
  })
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const row = await prisma.vipPartnerRedeemCode.create({
    data: { userId: input.userId, partnerId: partner.id, points: input.points, codeHash: 'pending', expiresAt: new Date(now.getTime() + CODE_TTL_MS) },
  })
  await prisma.vipPartnerRedeemCode.update({ where: { id: row.id }, data: { codeHash: hashCode(row.id, code) } })
  return { code, points: input.points, partnerName: partner.name, expiresAt: row.expiresAt.toISOString() }
}

/**
 * Staff side: spend the member's points with the code they show. Wrong codes
 * count against every live code for that member at this partner; five wrong
 * tries burn them. The code is claimed with one conditional update, so it
 * spends exactly once even when submitted twice at the same moment.
 */
export async function redeemAtPartner(
  staff: StaffContext,
  input: { memberNumber: string; code: string },
): Promise<{ txn: VipPartnerTxn; points: number }> {
  if (!staff.partner.allowRedemption) throw new RewardsError('redeem_off', 'Points can’t be spent at this partner.', 409)
  const code = input.code.replace(/\D/g, '')
  if (code.length !== 6) throw new RewardsError('bad_code', 'Enter the 6-digit code from the member’s app.', 400)
  const memberUserId = await activeMemberId(input.memberNumber)

  const now = new Date()
  const live = await prisma.vipPartnerRedeemCode.findMany({
    where: { userId: memberUserId, partnerId: staff.partner.id, usedAt: null, expiresAt: { gt: now }, failedAttempts: { lt: CODE_MAX_ATTEMPTS } },
    orderBy: { createdAt: 'desc' },
  })
  const match = live.find((c) => {
    const a = Buffer.from(hashCode(c.id, code))
    const b = Buffer.from(c.codeHash)
    return a.length === b.length && timingSafeEqual(a, b)
  })
  if (!match) {
    if (live.length) {
      await prisma.vipPartnerRedeemCode.updateMany({ where: { id: { in: live.map((c) => c.id) } }, data: { failedAttempts: { increment: 1 } } })
    }
    await logAudit({ userId: staff.userId, action: 'vip.partner.redeem_bad_code', entityType: 'VipPartner', entityId: staff.partner.id, metadata: { memberUserId } })
    throw new RewardsError('bad_code', 'That code is not valid. Ask the member to open Partners in their app and create a new one.', 409)
  }

  try {
    const txn = await prisma.$transaction(async (tx) => {
      const claim = await tx.vipPartnerRedeemCode.updateMany({
        where: { id: match.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (claim.count !== 1) throw new RewardsError('code_used', 'That code was already used.', 409)
      const spend = await spendPoints({
        tx,
        userId: memberUserId,
        points: match.points,
        type: 'REDEEM_PARTNER',
        description: `Spent at ${staff.partner.name}`,
        idempotencyKey: `partner-redeem:${match.id}`,
        source: `partner:${staff.partner.slug}`,
      })
      const row = await tx.vipPartnerTxn.create({
        data: {
          partnerId: staff.partner.id,
          memberUserId,
          staffUserId: staff.userId,
          kind: 'REDEEM',
          amountCents: match.points, // 1 point = 1 cent
          points: match.points,
          ledgerTxnId: spend.transactionId,
        },
      })
      await tx.vipPartnerRedeemCode.update({ where: { id: match.id }, data: { partnerTxnId: row.id } })
      return row
    })
    await logAudit({
      userId: staff.userId,
      action: 'vip.partner.redeem',
      entityType: 'VipPartnerTxn',
      entityId: txn.id,
      metadata: { partner: staff.partner.slug, memberUserId, points: match.points },
    })
    await evaluateBadges(memberUserId).catch(() => {})
    return { txn, points: match.points }
  } catch (e) {
    if (e instanceof InsufficientPointsError) {
      throw new RewardsError('not_enough_points', 'The member no longer has enough points for this code.', 409)
    }
    throw e
  }
}

/**
 * Void within 24 hours, exactly once (conditional voidedAt claim in the same
 * transaction as the REVERSAL). Voiding an award takes the points back — refused
 * if the member has already spent them. Not allowed once the month's statement
 * has been issued.
 */
export async function voidPartnerTxn(staff: StaffContext, input: { txnId: string; reason?: string | null }) {
  const t = await prisma.vipPartnerTxn.findUnique({ where: { id: input.txnId } })
  if (!t || t.partnerId !== staff.partner.id) throw new RewardsError('not_found', 'Transaction not found.', 404)
  if (t.voidedAt) return { txn: t, alreadyVoided: true }
  if (Date.now() - t.createdAt.getTime() >= VOID_WINDOW_MS) {
    throw new RewardsError('void_window', 'Transactions can only be voided within 24 hours. Contact the Vitality team.', 409)
  }
  const statement = await prisma.vipPartnerStatement.findUnique({
    where: { partnerId_period: { partnerId: t.partnerId, period: periodFor(t.createdAt) } },
    select: { status: true },
  })
  if (statement && statement.status !== 'DRAFT') {
    throw new RewardsError('statement_issued', 'This month’s statement was already issued. Contact the Vitality team.', 409)
  }

  try {
    const txn = await prisma.$transaction(async (tx) => {
      const claim = await tx.vipPartnerTxn.updateMany({
        where: { id: t.id, voidedAt: null },
        data: { voidedAt: new Date(), voidedById: staff.userId, voidReason: input.reason?.trim() || null },
      })
      if (claim.count !== 1) return null
      const ledger =
        t.kind === 'EARN'
          ? await spendPoints({
              tx,
              userId: t.memberUserId,
              points: t.points,
              type: 'REVERSAL',
              description: `Voided purchase at ${staff.partner.name}`,
              idempotencyKey: `${EARN_REVERSAL_PREFIX}partner:${t.id}`,
              source: `partner:${staff.partner.slug}`,
            })
          : await awardPoints({
              tx,
              userId: t.memberUserId,
              points: t.points,
              type: 'REVERSAL',
              description: `Returned: voided spend at ${staff.partner.name}`,
              idempotencyKey: `reverse-spend:partner:${t.id}`,
              source: `partner:${staff.partner.slug}`,
            })
      return tx.vipPartnerTxn.update({ where: { id: t.id }, data: { voidLedgerTxnId: ledger.transactionId } })
    })
    if (!txn) return { txn: await prisma.vipPartnerTxn.findUniqueOrThrow({ where: { id: t.id } }), alreadyVoided: true }
    await logAudit({
      userId: staff.userId,
      action: 'vip.partner.void',
      entityType: 'VipPartnerTxn',
      entityId: t.id,
      metadata: { partner: staff.partner.slug, kind: t.kind, points: t.points, reason: input.reason ?? null },
    })
    return { txn, alreadyVoided: false }
  } catch (e) {
    if (e instanceof InsufficientPointsError) {
      throw new RewardsError('points_spent', 'The member has already spent these points, so this purchase can’t be voided here. Contact the Vitality team.', 409)
    }
    throw e
  }
}

/** Recent transactions at the staff member's partner (portal list). */
export async function recentPartnerTxns(partnerId: string, take = 25) {
  const rows = await prisma.vipPartnerTxn.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' }, take })
  const cards = await prisma.vipMemberCard.findMany({ where: { userId: { in: [...new Set(rows.map((r) => r.memberUserId))] } } })
  const num = new Map(cards.map((c) => [c.userId, formatMemberNumber(c.memberNumber)]))
  return rows.map((r) => ({ ...publicTxn(r), memberNumber: num.get(r.memberUserId) ?? '' }))
}

/** Active partners for the member directory. */
export async function listDirectory() {
  return prisma.vipPartner.findMany({
    where: { active: true },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      description: true,
      website: true,
      address: true,
      category: true,
      earnPointsPerDollar: true,
      allowRedemption: true,
    },
  })
}
