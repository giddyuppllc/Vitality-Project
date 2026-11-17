import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { awardPointsForOrder } from '@/lib/loyalty'
import { awardPoints, pointsBalance } from '@/lib/vip/points'
import { purchasePoints, setEarningRules, EARNING_DEFAULTS, type EarningRules } from '@/lib/vip/earning'
import { redeemReward, cancelRedemption } from '@/lib/vip/catalog'
import { getCourse } from '@/lib/vip/classroom'
import { runPointsExpiry, pointsExpiryFor } from '@/lib/vip/points-expiry'
import { evaluateBadges, monthlyLeaderboard } from '@/lib/vip/badges'
import { generateMemberNumber, normalizeMemberNumber, getOrCreateMemberCard } from '@/lib/vip/member-card'
import { POST as redeemPOST } from '@/app/api/vip/rewards/redeem/route'
import { DELETE as memberCancel } from '@/app/api/vip/rewards/redemptions/[id]/route'
import { PATCH as prefsPATCH } from '@/app/api/vip/rewards/prefs/route'
import { POST as adminRedemptions } from '@/app/api/admin/vip/rewards/redemptions/route'
import { POST as adminCatalog } from '@/app/api/admin/vip/rewards/catalog/route'
import { POST as adminPoints } from '@/app/api/admin/vip/rewards/points/route'
import { PUT as earningPUT } from '@/app/api/admin/vip/rewards/earning/route'
import { POST as subscribePOST } from '@/app/api/membership/subscribe/route'
import { POST as markPaidPOST } from '@/app/api/admin/orders/[id]/mark-paid/route'
import { POST as zellePOST } from '@/app/api/checkout-zelle/route'
import { GET as expiryCron } from '@/app/api/cron/vip-points-expiry/route'
import { makeUser, params, req, setSession } from '../helpers'

const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const click = () => `ck_${uniq()}${uniq()}`

async function item(data: Partial<Parameters<typeof prisma.vipRewardItem.create>[0]['data']> & { kind: 'STORE_CREDIT' | 'PRODUCT' | 'MERCH' | 'TRAINING' | 'EXPERIENCE' }) {
  return prisma.vipRewardItem.create({
    data: { slug: `zz-${uniq()}`, title: 'ZZ reward', pointsCost: 1000, active: true, ...data } as Parameters<typeof prisma.vipRewardItem.create>[0]['data'],
  })
}

async function grant(userId: string, points: number) {
  await awardPoints({ userId, points, type: 'EARN_ADMIN', description: 'test grant', idempotencyKey: `test:${uniq()}` })
}

async function admin() {
  const a = await makeUser({ tag: 'rwe-admin', role: 'ADMIN' })
  setSession({ ...a, role: 'ADMIN' })
  return a
}

const SHIP = { name: 'ZZ Test', line1: '1 Test St', city: 'Testville', state: 'AZ', zip: '85001', country: 'US' }

describe('purchase points on .global (tier-scaled, exactly once per order)', () => {
  const rules = { ...EARNING_DEFAULTS } as EarningRules
  it('math: Club 5% / Plus 7.5% / Premium 10%; non-members keep 1 point per $1', () => {
    expect(purchasePoints(18000, 'PLUS', rules)).toBe(1350) // plan §9 worked example
    expect(purchasePoints(20000, 'CLUB', rules)).toBe(1000)
    expect(purchasePoints(20000, 'PREMIUM', rules)).toBe(2000)
    expect(purchasePoints(18050, 'NONE', rules)).toBe(180)
    // a member never earns less than the store rule
    expect(purchasePoints(18000, 'CLUB', { ...rules, 'vip.points.purchaseBaseBps': 0 })).toBe(180)
  })

  it('awardPointsForOrder: member rate, repeat call is a no-op', async () => {
    const m = await makeUser({ tag: 'rwe-buy', tier: 'PLUS' })
    const order = await prisma.order.create({ data: { orderNumber: `ZZ-${uniq()}`, email: m.email, userId: m.id, subtotal: 18000, total: 18000 } })
    const results = await Promise.all([1, 2, 3].map(() => awardPointsForOrder({ userId: m.id, orderId: order.id, orderTotal: 18000 })))
    expect(results.every((r) => r.pointsEarned === 1350)).toBe(true)
    expect(await pointsBalance(m.id)).toBe(1350)
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id, type: 'EARN_PURCHASE' } })).toBe(1)
    const acct = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: m.id } })
    expect(acct.lifetimeSpend).toBe(18000)
  })

  it('non-members are unchanged (1 point per $1)', async () => {
    const c = await makeUser({ tag: 'rwe-guest' })
    const order = await prisma.order.create({ data: { orderNumber: `ZZ-${uniq()}`, email: c.email, userId: c.id, subtotal: 18050, total: 18050 } })
    expect((await awardPointsForOrder({ userId: c.id, orderId: order.id, orderTotal: 18050 })).pointsEarned).toBe(180)
  })
})

describe('rewards catalog — redeem', () => {
  it('a double click (same key, concurrent) is ONE redemption and ONE spend', async () => {
    const m = await makeUser({ tag: 'rwe-dbl', tier: 'CLUB' })
    await grant(m.id, 5000)
    const it1 = await item({ kind: 'EXPERIENCE', pointsCost: 2000 })
    const key = click()
    setSession(m)
    const rs = await Promise.all([1, 2, 3, 4].map(() => redeemPOST(req('/api/vip/rewards/redeem', { body: { itemId: it1.id, clickKey: key } }))))
    expect(rs.map((r) => r.status).sort()).toEqual([200, 200, 200, 201])
    expect(await prisma.vipRedemption.count({ where: { userId: m.id } })).toBe(1)
    expect(await pointsBalance(m.id)).toBe(3000)
  })

  it('separate clicks never overdraw: balance for one → exactly one succeeds', async () => {
    const m = await makeUser({ tag: 'rwe-over', tier: 'CLUB' })
    await grant(m.id, 1500)
    const it1 = await item({ kind: 'EXPERIENCE', pointsCost: 1000 })
    setSession(m)
    const rs = await Promise.all([1, 2, 3].map(() => redeemPOST(req('/api/vip/rewards/redeem', { body: { itemId: it1.id, clickKey: click() } }))))
    const codes = await Promise.all(rs.map(async (r) => (r.status === 201 ? 'ok' : (await r.json()).code)))
    expect(codes.filter((c) => c === 'ok')).toHaveLength(1)
    expect(codes.filter((c) => c === 'not_enough_points')).toHaveLength(2)
    expect(await pointsBalance(m.id)).toBe(500)
  })

  it('per-member limit and stock hold under concurrency', async () => {
    const m = await makeUser({ tag: 'rwe-limit', tier: 'CLUB' })
    await grant(m.id, 10_000)
    const limited = await item({ kind: 'EXPERIENCE', pointsCost: 1000, perMemberLimit: 1 })
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: limited.id, clickKey: click() })),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await pointsBalance(m.id)).toBe(9000)

    const stocked = await item({ kind: 'MERCH', pointsCost: 500 })
    const opt = await prisma.vipRewardOption.create({ data: { itemId: stocked.id, label: 'M', stock: 1 } })
    const others = await Promise.all([1, 2, 3].map(async (i) => {
      const u = await makeUser({ tag: `rwe-stock${i}`, tier: 'CLUB' })
      await grant(u.id, 1000)
      return u
    }))
    const rs = await Promise.allSettled(
      others.map((u) => redeemReward({ userId: u.id, accessTier: 'CLUB', itemId: stocked.id, optionId: opt.id, clickKey: click(), shipping: SHIP })),
    )
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await prisma.vipRewardOption.findUniqueOrThrow({ where: { id: opt.id } })).stock).toBe(0)
    // the losers kept their points
    const balances = await Promise.all(others.map((u) => pointsBalance(u.id)))
    expect(balances.sort()).toEqual([1000, 1000, 500].sort())
  })

  it('tier restriction, size and address rules', async () => {
    const m = await makeUser({ tag: 'rwe-tier', tier: 'CLUB' })
    await grant(m.id, 10_000)
    const premium = await item({ kind: 'EXPERIENCE', minTier: 'PREMIUM' })
    await expect(redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: premium.id, clickKey: click() })).rejects.toMatchObject({ code: 'tier_required' })
    const merch = await item({ kind: 'MERCH' })
    const opt = await prisma.vipRewardOption.create({ data: { itemId: merch.id, label: 'L' } })
    await expect(redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: merch.id, clickKey: click(), shipping: SHIP })).rejects.toMatchObject({ code: 'option_required' })
    await expect(redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: merch.id, optionId: opt.id, clickKey: click() })).rejects.toMatchObject({ code: 'address_required' })
    expect(await pointsBalance(m.id)).toBe(10_000)
  })

  it('STORE_CREDIT lands in the StoreCredit ledger at once', async () => {
    const m = await makeUser({ tag: 'rwe-credit', tier: 'PLUS' })
    await grant(m.id, 2500)
    const sc = await item({ kind: 'STORE_CREDIT', pointsCost: 2500, creditCents: 2500 })
    const { redemption } = await redeemReward({ userId: m.id, accessTier: 'PLUS', itemId: sc.id, clickKey: click() })
    expect(redemption.status).toBe('FULFILLED')
    const credit = await prisma.storeCredit.findUniqueOrThrow({ where: { userId: m.id }, include: { transactions: true } })
    expect(credit.balance).toBe(2500)
    expect(credit.transactions.map((t) => t.type)).toEqual(['LOYALTY_REDEEM'])
    expect(await pointsBalance(m.id)).toBe(0)
    expect((await prisma.vipUserBadge.findMany({ where: { userId: m.id } })).map((b) => b.badgeKey)).toContain('rewards.first_redemption')
  })

  it('TRAINING unlocks the course in the classroom (VipCourseGrant), once', async () => {
    const m = await makeUser({ tag: 'rwe-train', tier: 'CLUB' })
    await grant(m.id, 3000)
    const course = await prisma.vipCourse.create({ data: { slug: `zz-course-${uniq()}`, title: 'ZZ course', minTier: 'PREMIUM', published: true } })
    expect((await getCourse(course.slug, m.id, 'CLUB'))!.allowed).toBe(false)
    const tr = await item({ kind: 'TRAINING', pointsCost: 1000, courseId: course.id })
    await redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: tr.id, clickKey: click() })
    expect((await getCourse(course.slug, m.id, 'CLUB'))!.allowed).toBe(true)
    await expect(redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: tr.id, clickKey: click() })).rejects.toMatchObject({ code: 'already_unlocked' })
    expect(await pointsBalance(m.id)).toBe(2000)
  })
})

describe('redemption queue — cancel refunds exactly once', () => {
  it('three concurrent admin cancels → one REVERSAL, stock returned', async () => {
    const m = await makeUser({ tag: 'rwe-cancel', tier: 'CLUB' })
    await grant(m.id, 2000)
    const merch = await item({ kind: 'MERCH', pointsCost: 1500 })
    const opt = await prisma.vipRewardOption.create({ data: { itemId: merch.id, label: 'S', stock: 3 } })
    const { redemption } = await redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: merch.id, optionId: opt.id, clickKey: click(), shipping: SHIP })
    expect(await pointsBalance(m.id)).toBe(500)
    await admin()
    const rs = await Promise.all(
      [1, 2, 3].map(() => adminRedemptions(req('/api/admin/vip/rewards/redemptions', { body: { op: 'cancel', id: redemption.id, reason: 'zz' } }))),
    )
    expect(rs.every((r) => r.status === 200)).toBe(true)
    expect(await pointsBalance(m.id)).toBe(2000)
    const acct = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: m.id } })
    expect(await prisma.loyaltyTransaction.count({ where: { accountId: acct.id, type: 'REVERSAL' } })).toBe(1)
    expect((await prisma.vipRewardOption.findUniqueOrThrow({ where: { id: opt.id } })).stock).toBe(3)
    // a cancelled redemption cannot be fulfilled
    const f = await adminRedemptions(req('/api/admin/vip/rewards/redemptions', { body: { op: 'fulfil', id: redemption.id } }))
    expect(f.status).toBe(409)
  })

  it('status flow requested → approved → fulfilled; fulfilled cannot be cancelled; audit rows', async () => {
    const m = await makeUser({ tag: 'rwe-flow', tier: 'CLUB' })
    await grant(m.id, 1000)
    const exp = await item({ kind: 'EXPERIENCE', pointsCost: 1000 })
    const { redemption } = await redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: exp.id, clickKey: click(), memberNote: 'Weekday evenings' })
    const a = await admin()
    expect((await adminRedemptions(req('/x', { body: { op: 'approve', id: redemption.id } }))).status).toBe(200)
    expect((await adminRedemptions(req('/x', { body: { op: 'fulfil', id: redemption.id } }))).status).toBe(200)
    expect((await adminRedemptions(req('/x', { body: { op: 'cancel', id: redemption.id } }))).status).toBe(409)
    expect(await pointsBalance(m.id)).toBe(0)
    const actions = (await prisma.auditLog.findMany({ where: { userId: a.id }, select: { action: true } })).map((x) => x.action)
    expect(actions).toEqual(expect.arrayContaining(['vip.reward.approve', 'vip.reward.fulfil']))
  })

  it('members cancel only their own REQUESTED redemptions', async () => {
    const m = await makeUser({ tag: 'rwe-mc', tier: 'CLUB' })
    const other = await makeUser({ tag: 'rwe-mc2', tier: 'CLUB' })
    await grant(m.id, 1000)
    const exp = await item({ kind: 'EXPERIENCE', pointsCost: 1000 })
    const { redemption } = await redeemReward({ userId: m.id, accessTier: 'CLUB', itemId: exp.id, clickKey: click() })
    setSession(other)
    expect((await memberCancel(req('/x', { method: 'DELETE' }), params({ id: redemption.id }))).status).toBe(404)
    setSession(m)
    const ok = await memberCancel(req('/x', { method: 'DELETE' }), params({ id: redemption.id }))
    expect(ok.status).toBe(200)
    expect(await pointsBalance(m.id)).toBe(1000)
    const again = await cancelRedemption({ id: redemption.id, by: 'member', actorUserId: m.id })
    expect(again.alreadyCancelled).toBe(true)
    expect(await pointsBalance(m.id)).toBe(1000)
  })
})

describe('admin catalog + adjustments', () => {
  it('validates kind requirements and audits', async () => {
    const a = await admin()
    const bad = await adminCatalog(req('/x', { body: { op: 'create', item: { kind: 'STORE_CREDIT', title: 'ZZ credit', pointsCost: 500 } } }))
    expect(bad.status).toBe(400)
    const ok = await adminCatalog(req('/x', { body: { op: 'create', item: { kind: 'STORE_CREDIT', title: 'ZZ credit', pointsCost: 500, creditCents: 500, active: true } } }))
    expect(ok.status).toBe(201)
    const badImg = await adminCatalog(req('/x', { body: { op: 'create', item: { kind: 'EXPERIENCE', title: 'ZZ img', pointsCost: 5, imageUrl: 'javascript:alert(1)' } } }))
    expect(badImg.status).toBe(400)
    expect((await prisma.auditLog.findMany({ where: { userId: a.id } })).map((x) => x.action)).toContain('vip.reward_item.create')
  })

  it('manual adjustment: reason required, never overdraws, one per click, audited', async () => {
    const m = await makeUser({ tag: 'rwe-adj', tier: 'CLUB' })
    const a = await admin()
    expect((await adminPoints(req('/x', { body: { member: m.email, points: 500, reason: '', clickKey: click() } }))).status).toBe(400)
    const key = click()
    await Promise.all([1, 2].map(() => adminPoints(req('/x', { body: { member: m.email, points: 500, reason: 'Goodwill', clickKey: key } }))))
    expect(await pointsBalance(m.id)).toBe(500)
    const over = await adminPoints(req('/x', { body: { member: m.email, points: -600, reason: 'Correction', clickKey: click() } }))
    expect(over.status).toBe(409)
    const card = await getOrCreateMemberCard(m.id)
    expect((await adminPoints(req('/x', { body: { member: card.memberNumber, points: -200, reason: 'Correction', clickKey: click() } }))).status).toBe(200)
    expect(await pointsBalance(m.id)).toBe(300)
    expect((await prisma.auditLog.findMany({ where: { userId: a.id, action: 'vip.points.adjust' } }))).toHaveLength(2)
  })

  it('earning rules reject out-of-range values', async () => {
    await admin()
    expect((await earningPUT(req('/x', { method: 'PUT', body: { 'vip.points.redeemCapPct': 150 } }))).status).toBe(400)
    expect((await earningPUT(req('/x', { method: 'PUT', body: { 'vip.points.lesson': -1 } }))).status).toBe(400)
    expect((await earningPUT(req('/x', { method: 'PUT', body: { 'vip.points.nope': 1 } }))).status).toBe(400)
    expect((await earningPUT(req('/x', { method: 'PUT', body: { 'vip.points.lesson': 50 } }))).status).toBe(200)
  })
})

describe('member numbers', () => {
  it('Luhn check digit catches a typo; formatting is ignored', () => {
    for (let i = 0; i < 50; i++) {
      const n = generateMemberNumber()
      expect(normalizeMemberNumber(n)).toBe(n)
      expect(normalizeMemberNumber(`vp-${n.slice(2, 6)} ${n.slice(6)}`)).toBe(n)
      const typo = `${n.slice(0, 9)}${(Number(n[9]) + 1) % 10}`
      expect(normalizeMemberNumber(typo)).toBeNull()
    }
  })
})

describe('referral: 2,500 points when the referred person’s FIRST membership invoice is paid', () => {
  it('records on signup, awards once on first payment, never on renewal or self-referral', async () => {
    const referrer = await makeUser({ tag: 'rwe-ref', tier: 'PLUS' })
    const card = await getOrCreateMemberCard(referrer.id)
    const newbie = await makeUser({ tag: 'rwe-newbie' })
    setSession(newbie)
    const sub = await subscribePOST(req('/api/membership/subscribe', { body: { tier: 'CLUB', ref: card.memberNumber } }))
    expect(sub.status).toBe(200)
    expect(await prisma.vipReferral.findUnique({ where: { referredUserId: newbie.id } })).not.toBeNull()
    const invoice = await prisma.order.findFirstOrThrow({ where: { userId: newbie.id, notes: { startsWith: 'MEMBERSHIP:' } } })
    await admin()
    await Promise.all([1, 2].map(() => markPaidPOST(req(`/x`, { method: 'POST' }), params({ id: invoice.id }))))
    expect(await pointsBalance(referrer.id)).toBe(2500)
    // A renewal invoice paid later pays nothing more.
    const mem = await prisma.membership.findUniqueOrThrow({ where: { userId: newbie.id } })
    const renewal = await prisma.order.create({
      data: { orderNumber: `ZZ-R-${uniq()}`, userId: newbie.id, email: newbie.email, subtotal: 2500, total: 2500, paymentMethod: 'zelle', notes: `MEMBERSHIP:${mem.id}:CLUB` },
    })
    await markPaidPOST(req('/x', { method: 'POST' }), params({ id: renewal.id }))
    expect(await pointsBalance(referrer.id)).toBe(2500)

    // Self-referral is ignored.
    const selfie = await makeUser({ tag: 'rwe-self' })
    const selfCard = await getOrCreateMemberCard(selfie.id)
    setSession(selfie)
    await subscribePOST(req('/api/membership/subscribe', { body: { tier: 'CLUB', ref: selfCard.memberNumber } }))
    expect(await prisma.vipReferral.findUnique({ where: { referredUserId: selfie.id } })).toBeNull()
  })
})

describe('points expiry after N months without activity', () => {
  it('dry run lists and writes nothing; the real run expires once; recent activity is safe', async () => {
    const idle = await makeUser({ tag: 'rwe-idle', tier: 'CLUB' })
    const busy = await makeUser({ tag: 'rwe-busy', tier: 'CLUB' })
    await grant(idle.id, 700)
    await grant(busy.id, 300)
    const idleAcct = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: idle.id } })
    const longAgo = new Date(Date.now() - 400 * 86400e3)
    await prisma.loyaltyTransaction.updateMany({ where: { accountId: idleAcct.id }, data: { createdAt: longAgo } })
    await prisma.loyaltyAccount.update({ where: { id: idleAcct.id }, data: { createdAt: longAgo } })

    const dry = await runPointsExpiry({ dryRun: true })
    expect(dry.decisions.find((d) => d.userId === idle.id)?.outcome).toBe('would_expire')
    expect(dry.decisions.find((d) => d.userId === busy.id)).toBeUndefined()
    expect(await pointsBalance(idle.id)).toBe(700)

    const runs = await Promise.all([runPointsExpiry(), runPointsExpiry()])
    expect(runs.reduce((n, r) => n + (r.decisions.find((d) => d.userId === idle.id && d.outcome === 'expired') ? 1 : 0), 0)).toBe(1)
    expect(await pointsBalance(idle.id)).toBe(0)
    expect(await pointsBalance(busy.id)).toBe(300)
    expect(await prisma.loyaltyTransaction.count({ where: { accountId: idleAcct.id, type: 'EXPIRE' } })).toBe(1)
    expect((await pointsExpiryFor(busy.id))!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 300 * 86400e3)
  })

  it('0 months = never; the cron is guarded by CRON_SECRET', async () => {
    await setEarningRules({ 'vip.points.expiryMonths': 0 })
    try {
      expect((await runPointsExpiry()).examined).toBe(0)
    } finally {
      await setEarningRules({ 'vip.points.expiryMonths': 12 })
    }
    process.env.CRON_SECRET = 'zz-cron'
    try {
      expect((await expiryCron(new NextRequest('http://x/api/cron/vip-points-expiry?dryRun=1'))).status).toBe(403)
      const ok = await expiryCron(new NextRequest('http://x/api/cron/vip-points-expiry?dryRun=1', { headers: { authorization: 'Bearer zz-cron' } }))
      expect(ok.status).toBe(200)
      expect((await ok.json()).dryRun).toBe(true)
    } finally {
      delete process.env.CRON_SECRET
    }
  })
})

describe('redemption cap at .global checkout (optional)', () => {
  it('off by default; at 50% points cover at most half of the goods', async () => {
    const product = await prisma.product.create({
      data: { name: 'ZZ-TEST cap fixture', description: 'x', slug: `zz-cap-${uniq()}`, price: 4000, status: 'ACTIVE', trackInventory: false },
    })
    const ADDRESS = { name: 'ZZ', line1: '1 Test St', city: 'T', state: 'AZ', zip: '85001', country: 'US' }
    const place = async (tag: string) => {
      const u = await makeUser({ tag })
      await prisma.loyaltyAccount.create({ data: { userId: u.id, points: 10_000 } })
      setSession(u)
      const r = await zellePOST(req('/api/checkout-zelle', { body: { items: [{ productId: product.id, quantity: 1 }], email: u.email, shippingAddress: ADDRESS, loyaltyPointsToRedeem: 10_000, useStoreCredit: false } }))
      expect(r.status).toBe(200)
      return prisma.order.findFirstOrThrow({ where: { userId: u.id } })
    }
    expect((await place('rwe-cap-off')).loyaltyPointsUsed).toBe(4000)
    await setEarningRules({ 'vip.points.redeemCapPct': 50 })
    try {
      expect((await place('rwe-cap-on')).loyaltyPointsUsed).toBe(2000)
    } finally {
      await setEarningRules({ 'vip.points.redeemCapPct': 0 })
    }
  })
})

describe('badges + leaderboard', () => {
  it('10k lifetime badge; leaderboard respects "hide me" and inactive members', async () => {
    const a = await makeUser({ tag: 'rwe-lb-a', tier: 'PREMIUM' })
    const b = await makeUser({ tag: 'rwe-lb-b', tier: 'PLUS' })
    const lapsed = await makeUser({ tag: 'rwe-lb-c', tier: 'CLUB', status: 'CANCELLED' })
    await awardPoints({ userId: a.id, points: 10_500, type: 'EARN_ENGAGEMENT', description: 'ZZ', idempotencyKey: `t:${uniq()}` })
    await awardPoints({ userId: b.id, points: 999_000, type: 'EARN_ENGAGEMENT', description: 'ZZ', idempotencyKey: `t:${uniq()}` })
    await awardPoints({ userId: lapsed.id, points: 900_000, type: 'EARN_ENGAGEMENT', description: 'ZZ', idempotencyKey: `t:${uniq()}` })
    expect(await evaluateBadges(a.id)).toContain('rewards.points_10k')
    expect(await evaluateBadges(a.id)).toEqual([])
    let board = await monthlyLeaderboard({ limit: 100 })
    expect(board[0].userId).toBe(b.id)
    expect(board.some((r) => r.userId === lapsed.id)).toBe(false)
    setSession(b)
    expect((await prefsPATCH(req('/x', { method: 'PATCH', body: { hideFromLeaderboards: true } }))).status).toBe(200)
    board = await monthlyLeaderboard({ limit: 100 })
    expect(board.some((r) => r.userId === b.id)).toBe(false)
    expect(board.some((r) => r.userId === a.id)).toBe(true)
  })
})
