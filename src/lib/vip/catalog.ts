import type { MembershipTier, VipRedemption, VipRewardKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrementStock } from '@/lib/inventory'
import { logAudit } from '@/lib/audit'
import { tierAllows } from './access'
import { awardPoints, spendPoints, InsufficientPointsError, type Tx } from './points'
import { grantTrainingAccess, hasCourseGrant } from './course-grants'
import { RewardsError, isUniqueViolation } from './rewards-errors'
import { evaluateBadges } from './badges'

/**
 * The rewards catalog: members spend points (lib/vip/points.ts, the shared
 * ledger) on admin-managed rewards.
 *
 *   STORE_CREDIT  instant — credit lands in the existing StoreCredit ledger
 *                 (LOYALTY_REDEEM line), spendable at both .global checkouts.
 *   TRAINING      instant — a VipCourseGrant opens the course in the classroom.
 *   PRODUCT       a request the team fulfils: they ship the .global product/
 *                 variant to the address given; stock is taken with the store's
 *                 guarded decrementStock when it is marked fulfilled. (Chosen
 *                 over a 100%-off discount code: a code is shareable, has to
 *                 win against every checkout rule — member pricing, caps,
 *                 shipping, tax — and would put a $0 order through the money
 *                 path; a request is one row the team ships from.)
 *   MERCH         a request with a size; size stock is reserved at redemption.
 *   EXPERIENCE    a request (e.g. 1:1 coaching); the team schedules it.
 *
 * Every redemption: one transaction that locks the member's points row, checks
 * the per-member limit, reserves stock, writes the redemption (its
 * idempotencyKey makes a double click one redemption) and spends the points
 * (never overdraws). Cancelling (member while REQUESTED, admin while
 * REQUESTED/APPROVED) returns the points as a REVERSAL exactly once and puts
 * reserved stock back.
 */

export const KIND_LABEL: Record<VipRewardKind, string> = {
  STORE_CREDIT: 'Store credit',
  PRODUCT: 'Product',
  MERCH: 'Merch',
  TRAINING: 'Training',
  EXPERIENCE: 'Experience',
}

export const SHIPPED_KINDS: VipRewardKind[] = ['PRODUCT', 'MERCH']
const INSTANT_KINDS: VipRewardKind[] = ['STORE_CREDIT', 'TRAINING']

export interface ShippingAddress {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
}

export type CatalogEntry = Awaited<ReturnType<typeof listCatalog>>[number]

/** Active rewards with the viewer's eligibility. */
export async function listCatalog(viewer: { userId: string; accessTier: MembershipTier }) {
  const [items, balance, mine, grants] = await Promise.all([
    prisma.vipRewardItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { options: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
    }),
    prisma.loyaltyAccount.findUnique({ where: { userId: viewer.userId }, select: { points: true } }),
    prisma.vipRedemption.groupBy({
      by: ['itemId'],
      where: { userId: viewer.userId, status: { not: 'CANCELLED' } },
      _count: { _all: true },
    }),
    prisma.vipCourseGrant.findMany({ where: { userId: viewer.userId }, select: { courseId: true } }),
  ])
  const used = new Map(mine.map((m) => [m.itemId, m._count._all]))
  const granted = new Set(grants.map((g) => g.courseId))
  const courseIds = items.map((i) => i.courseId).filter((x): x is string => !!x)
  const courses = courseIds.length
    ? await prisma.vipCourse.findMany({ where: { id: { in: courseIds } }, select: { id: true, minTier: true, title: true, published: true } })
    : []
  const courseMap = new Map(courses.map((c) => [c.id, c]))
  const points = balance?.points ?? 0
  return items.map((i) => {
    const hasOptions = i.options.length > 0
    const inStock = hasOptions ? i.options.some((o) => o.stock === null || o.stock > 0) : i.stock === null || i.stock > 0
    const usedCount = used.get(i.id) ?? 0
    const course = i.courseId ? courseMap.get(i.courseId) : undefined
    const alreadyUnlocked = i.kind === 'TRAINING' && !!course && (granted.has(course.id) || tierAllows(viewer.accessTier, course.minTier))
    return {
      id: i.id,
      slug: i.slug,
      kind: i.kind,
      title: i.title,
      description: i.description,
      imageUrl: i.imageUrl,
      pointsCost: i.pointsCost,
      creditCents: i.creditCents,
      minTier: i.minTier,
      stock: i.stock,
      perMemberLimit: i.perMemberLimit,
      options: i.options.map((o) => ({ id: o.id, label: o.label, available: o.stock === null || o.stock > 0, stock: o.stock })),
      tierOk: tierAllows(viewer.accessTier, i.minTier),
      inStock,
      limitReached: i.perMemberLimit !== null && usedCount >= i.perMemberLimit,
      canAfford: points >= i.pointsCost,
      alreadyUnlocked,
      courseTitle: course?.title ?? null,
    }
  })
}

async function lockPoints(tx: Tx, userId: string) {
  await tx.loyaltyAccount.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } })
  // Serialise this member's redemptions: the per-member limit and stock
  // checks below are then race-free.
  await tx.$queryRaw`SELECT id FROM loyalty_accounts WHERE "userId" = ${userId} FOR UPDATE`
}

export interface RedeemResult {
  redemption: VipRedemption
  duplicate: boolean
}

export async function redeemReward(args: {
  userId: string
  accessTier: MembershipTier
  itemId: string
  optionId?: string | null
  clickKey: string
  shipping?: ShippingAddress | null
  memberNote?: string | null
}): Promise<RedeemResult> {
  const { userId, itemId } = args
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(args.clickKey)) throw new RewardsError('bad_request', 'Missing request key.', 400)
  const idempotencyKey = `redeem:${userId}:${args.clickKey}`

  const prior = await prisma.vipRedemption.findUnique({ where: { idempotencyKey } })
  if (prior) return { redemption: prior, duplicate: true }

  const item = await prisma.vipRewardItem.findUnique({ where: { id: itemId }, include: { options: true } })
  if (!item || !item.active) throw new RewardsError('not_found', 'That reward is no longer available.', 404)
  if (!tierAllows(args.accessTier, item.minTier)) {
    throw new RewardsError('tier_required', 'This reward opens at a higher membership level.', 403)
  }

  const option = args.optionId ? item.options.find((o) => o.id === args.optionId) : null
  if (args.optionId && !option) throw new RewardsError('bad_option', 'Choose one of the listed sizes.', 400)
  if (item.options.length > 0 && !option) throw new RewardsError('option_required', 'Choose a size first.', 400)

  const shipped = SHIPPED_KINDS.includes(item.kind)
  if (shipped && !args.shipping) throw new RewardsError('address_required', 'Add a shipping address.', 400)

  if (item.kind === 'TRAINING') {
    if (!item.courseId) throw new RewardsError('misconfigured', 'This reward is not set up yet.', 409)
    const course = await prisma.vipCourse.findUnique({ where: { id: item.courseId }, select: { minTier: true } })
    if (!course) throw new RewardsError('misconfigured', 'This reward is not set up yet.', 409)
    if (tierAllows(args.accessTier, course.minTier) || (await hasCourseGrant(userId, item.courseId))) {
      throw new RewardsError('already_unlocked', 'You already have this training.', 409)
    }
  }
  if (item.kind === 'STORE_CREDIT' && !(item.creditCents && item.creditCents > 0)) {
    throw new RewardsError('misconfigured', 'This reward is not set up yet.', 409)
  }
  if (item.kind === 'PRODUCT' && !item.productId) throw new RewardsError('misconfigured', 'This reward is not set up yet.', 409)

  const instant = INSTANT_KINDS.includes(item.kind)
  const now = new Date()

  let redemption: VipRedemption
  try {
    redemption = await prisma.$transaction(async (tx) => {
      await lockPoints(tx, userId)

      if (item.perMemberLimit !== null) {
        const used = await tx.vipRedemption.count({ where: { userId, itemId, status: { not: 'CANCELLED' } } })
        if (used >= item.perMemberLimit) {
          throw new RewardsError('limit_reached', `You have redeemed this reward the maximum number of times (${item.perMemberLimit}).`, 409)
        }
      }

      // Reserve stock (conditional decrement — never below zero).
      if (option) {
        const fresh = await tx.vipRewardOption.findUniqueOrThrow({ where: { id: option.id } })
        if (fresh.stock !== null) {
          const { count } = await tx.vipRewardOption.updateMany({ where: { id: option.id, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } })
          if (count !== 1) throw new RewardsError('out_of_stock', `${option.label} is out of stock.`, 409)
        }
      } else {
        const fresh = await tx.vipRewardItem.findUniqueOrThrow({ where: { id: itemId }, select: { stock: true } })
        if (fresh.stock !== null) {
          const { count } = await tx.vipRewardItem.updateMany({ where: { id: itemId, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } })
          if (count !== 1) throw new RewardsError('out_of_stock', 'This reward is out of stock.', 409)
        }
      }

      const row = await tx.vipRedemption.create({
        data: {
          userId,
          itemId,
          optionId: option?.id ?? null,
          kind: item.kind,
          title: item.title,
          optionLabel: option?.label ?? null,
          pointsSpent: item.pointsCost,
          status: instant ? 'FULFILLED' : 'REQUESTED',
          fulfilledAt: instant ? now : null,
          idempotencyKey,
          shippingAddress: shipped && args.shipping ? JSON.stringify(args.shipping) : null,
          memberNote: args.memberNote?.trim() || null,
        },
      })

      const spend = await spendPoints({
        tx,
        userId,
        points: item.pointsCost,
        type: 'REDEEM_REWARD',
        description: `Redeemed: ${item.title}`,
        idempotencyKey: `reward:${row.id}`,
        source: 'vip:rewards',
      })

      let storeCreditTxnId: string | null = null
      if (item.kind === 'STORE_CREDIT') {
        const credit = await tx.storeCredit.upsert({
          where: { userId },
          update: { balance: { increment: item.creditCents! } },
          create: { userId, balance: item.creditCents! },
          select: { id: true },
        })
        const line = await tx.storeCreditTxn.create({
          data: {
            creditId: credit.id,
            type: 'LOYALTY_REDEEM',
            amount: item.creditCents!,
            description: `Rewards: ${item.pointsCost} points → store credit (redemption ${row.id})`,
          },
        })
        storeCreditTxnId = line.id
      }
      if (item.kind === 'TRAINING') {
        await grantTrainingAccess(userId, item.courseId!, `reward:${row.id}`, tx)
      }

      return tx.vipRedemption.update({ where: { id: row.id }, data: { spendTxnId: spend.transactionId, storeCreditTxnId } })
    })
  } catch (e) {
    if (e instanceof InsufficientPointsError) throw new RewardsError('not_enough_points', 'You don’t have enough points for this reward yet.', 409)
    if (isUniqueViolation(e)) {
      const row = await prisma.vipRedemption.findUnique({ where: { idempotencyKey } })
      if (row) return { redemption: row, duplicate: true }
    }
    throw e
  }

  await logAudit({
    userId,
    action: 'vip.reward.redeem',
    entityType: 'VipRedemption',
    entityId: redemption.id,
    metadata: { itemId, kind: item.kind, points: item.pointsCost, option: option?.label ?? null, status: redemption.status },
  })
  await evaluateBadges(userId).catch(() => {})
  return { redemption, duplicate: false }
}

/**
 * Cancel and refund. Exactly once: the status flips with one conditional
 * update in the same transaction as the REVERSAL (keyed refund:redemption:<id>).
 * Members may cancel their own while REQUESTED; admins while REQUESTED or
 * APPROVED. Fulfilled rewards can't be cancelled.
 */
export async function cancelRedemption(args: {
  id: string
  by: 'member' | 'admin'
  actorUserId: string
  reason?: string | null
}): Promise<{ redemption: VipRedemption; refunded: number; alreadyCancelled: boolean }> {
  const current = await prisma.vipRedemption.findUnique({ where: { id: args.id } })
  if (!current || (args.by === 'member' && current.userId !== args.actorUserId)) {
    throw new RewardsError('not_found', 'Redemption not found.', 404)
  }
  if (current.status === 'CANCELLED') return { redemption: current, refunded: 0, alreadyCancelled: true }
  const allowed: VipRedemption['status'][] = args.by === 'member' ? ['REQUESTED'] : ['REQUESTED', 'APPROVED']
  if (!allowed.includes(current.status)) {
    throw new RewardsError(
      'not_cancellable',
      args.by === 'member' ? 'This request is already being handled — message the team to change it.' : `A ${current.status.toLowerCase()} redemption can’t be cancelled.`,
      409,
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.vipRedemption.updateMany({
      where: { id: current.id, status: { in: allowed } },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: args.by,
        handledById: args.by === 'admin' ? args.actorUserId : undefined,
        adminNote: args.by === 'admin' && args.reason ? args.reason : undefined,
      },
    })
    if (count !== 1) return null // someone else cancelled/handled it first
    const refund = await awardPoints({
      tx,
      userId: current.userId,
      points: current.pointsSpent,
      type: 'REVERSAL',
      description: `Returned: ${current.title} (cancelled)`,
      idempotencyKey: `refund:redemption:${current.id}`,
      source: 'vip:rewards',
    })
    if (current.optionId) {
      await tx.vipRewardOption.updateMany({ where: { id: current.optionId, stock: { not: null } }, data: { stock: { increment: 1 } } })
    } else {
      await tx.vipRewardItem.updateMany({ where: { id: current.itemId, stock: { not: null } }, data: { stock: { increment: 1 } } })
    }
    const updated = await tx.vipRedemption.update({ where: { id: current.id }, data: { refundTxnId: refund.transactionId } })
    return { redemption: updated, refunded: refund.duplicate ? 0 : current.pointsSpent }
  })

  if (!result) {
    const now = await prisma.vipRedemption.findUniqueOrThrow({ where: { id: current.id } })
    if (now.status === 'CANCELLED') return { redemption: now, refunded: 0, alreadyCancelled: true }
    throw new RewardsError('not_cancellable', 'This redemption changed meanwhile — reload and try again.', 409)
  }
  await logAudit({
    userId: args.actorUserId,
    action: 'vip.reward.cancel',
    entityType: 'VipRedemption',
    entityId: current.id,
    metadata: { by: args.by, memberId: current.userId, pointsReturned: result.refunded, reason: args.reason ?? null },
  })
  return { ...result, alreadyCancelled: false }
}

export async function approveRedemption(id: string, adminId: string, note?: string | null) {
  const { count } = await prisma.vipRedemption.updateMany({
    where: { id, status: 'REQUESTED' },
    data: { status: 'APPROVED', approvedAt: new Date(), handledById: adminId, ...(note ? { adminNote: note } : {}) },
  })
  if (count !== 1) throw new RewardsError('bad_status', 'Only a requested redemption can be approved.', 409)
  await logAudit({ userId: adminId, action: 'vip.reward.approve', entityType: 'VipRedemption', entityId: id })
}

/** Mark shipped/delivered. PRODUCT rewards take the .global stock here (guarded, never below zero). */
export async function fulfilRedemption(id: string, adminId: string, opts: { trackingNumber?: string | null; note?: string | null } = {}) {
  const r = await prisma.vipRedemption.findUnique({ where: { id }, include: { item: { select: { productId: true, variantId: true } } } })
  if (!r) throw new RewardsError('not_found', 'Redemption not found.', 404)
  const { count } = await prisma.vipRedemption.updateMany({
    where: { id, status: { in: ['REQUESTED', 'APPROVED'] } },
    data: {
      status: 'FULFILLED',
      fulfilledAt: new Date(),
      handledById: adminId,
      approvedAt: r.approvedAt ?? new Date(),
      ...(opts.trackingNumber ? { trackingNumber: opts.trackingNumber } : {}),
      ...(opts.note ? { adminNote: opts.note } : {}),
    },
  })
  if (count !== 1) throw new RewardsError('bad_status', 'Only a requested or approved redemption can be fulfilled.', 409)
  if (r.kind === 'PRODUCT' && r.item.productId) {
    await decrementStock({ productId: r.item.productId, variantId: r.item.variantId, quantity: 1 }, 'vip-reward').catch((err) =>
      console.error('[vip rewards] stock decrement failed:', err),
    )
  }
  await logAudit({
    userId: adminId,
    action: 'vip.reward.fulfil',
    entityType: 'VipRedemption',
    entityId: id,
    metadata: { kind: r.kind, trackingNumber: opts.trackingNumber ?? null },
  })
}

export function parseShipping(json: string | null): ShippingAddress | null {
  if (!json) return null
  try {
    return JSON.parse(json) as ShippingAddress
  } catch {
    return null
  }
}

export const STATUS_LABEL: Record<VipRedemption['status'], string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled — points returned',
}
