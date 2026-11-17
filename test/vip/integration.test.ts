import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeUser, params, req, setSession } from '../helpers'
import { POST as markPaidPOST } from '@/app/api/admin/orders/[id]/mark-paid/route'
import { PATCH as orderPATCH } from '@/app/api/admin/orders/[id]/route'
import * as adminSettings from '@/app/api/admin/vip/settings/route'
import * as adminFitSettings from '@/app/api/admin/vip/fitness/settings/route'
import * as adminEarning from '@/app/api/admin/vip/rewards/earning/route'
import * as adminFitExercises from '@/app/api/admin/vip/fitness/exercises/route'
import * as adminClassroom from '@/app/api/admin/vip/classroom/route'
import * as progress from '@/app/api/vip/lessons/[id]/progress/route'
import * as eventJoin from '@/app/api/vip/events/[id]/join/route'
import * as rewardsPrefs from '@/app/api/vip/rewards/prefs/route'
import * as fitPrefs from '@/app/api/vip/fitness/prefs/route'
import { EARNING_RULES, getEarningRule, getEarningRules } from '@/lib/vip/earning'
import { earningTable } from '@/lib/vip/points-view'
import { getFitnessPrefs } from '@/lib/vip/fitness/profile'
import { isHiddenFromLeaderboards } from '@/lib/vip/leaderboards'
import { trainingNote } from '@/lib/vip/training-invoice'
import { grantTrainingAccess, hasCourseGrant } from '@/lib/vip/course-grants'
import { redeemReward } from '@/lib/vip/catalog'
import { awardPoints, pointsBalance } from '@/lib/vip/points'
import { loadDashboard } from '@/lib/vip/dashboard'
import { loadVipViewer } from '@/lib/vip/access'

/**
 * The seams between the four clubhouse feature branches (rewards, academy,
 * social, fitness): one earning-rules registry, one grant table, one
 * leaderboard switch, both paid paths, attendance points, admin images and
 * the dashboard's cross-feature cards.
 */
type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => (fn as H)(r, params(p))
type U = Awaited<ReturnType<typeof makeUser>>
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const keyed = (key: string) => prisma.loyaltyTransaction.count({ where: { idempotencyKey: key } })

let admin: U
const asAdmin = () => setSession({ ...admin, role: 'ADMIN' })

beforeAll(async () => {
  admin = await makeUser({ tag: 'int-admin', role: 'ADMIN' })
})
beforeEach(async () => {
  await prisma.siteSetting.deleteMany({ where: { OR: [{ key: { startsWith: 'vip.points.' } }, { key: { startsWith: 'vip.fitness.points.' } }] } })
})

describe('earning rules: ONE registry', () => {
  it('lists every rule the four features pay', () => {
    const keys = EARNING_RULES.map((r) => r.key)
    for (const k of [
      'vip.points.purchaseBaseBps', 'vip.points.referral', 'vip.points.lesson', 'vip.points.quiz', 'vip.points.course',
      'vip.points.firstPost', 'vip.points.postDay', 'vip.points.workout', 'vip.points.checkin', 'vip.points.streak7',
      'vip.points.program', 'vip.points.challengeDefault', 'vip.points.event',
    ]) expect(keys, k).toContain(k)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('reads the keys the feature branches used as fallbacks; the canonical key wins once saved', async () => {
    await prisma.siteSetting.createMany({
      data: [
        { key: 'vip.points.lessonComplete', value: '70' },
        { key: 'vip.points.quizPassed', value: '0' },
        { key: 'vip.fitness.points.workout', value: '40' },
        { key: 'vip.fitness.points.programComplete', value: '900' },
      ],
    })
    const r = await getEarningRules()
    expect(r['vip.points.lesson']).toBe(70)
    expect(r['vip.points.quiz']).toBe(0)
    expect(r['vip.points.workout']).toBe(40)
    expect(r['vip.points.program']).toBe(900)
    expect(r['vip.points.course']).toBe(500) // default
    await prisma.siteSetting.create({ data: { key: 'vip.points.lesson', value: '55' } })
    expect(await getEarningRule('vip.points.lesson')).toBe(55)
  })

  it('every admin path writes the same value: earning page, old settings route (old key), fitness settings (old key)', async () => {
    asAdmin()
    expect((await call(adminEarning.PUT, req('/x', { method: 'PUT', body: { 'vip.points.checkin': 8 } }))).status).toBe(200)
    expect((await getFitnessPrefs(admin.id)) && (await getEarningRule('vip.points.checkin'))).toBe(8)
    expect((await call(adminSettings.PUT, req('/x', { method: 'PUT', body: { 'vip.points.courseComplete': 650, 'vip.points.postDay': 12 } }))).status).toBe(200)
    expect(await getEarningRule('vip.points.course')).toBe(650)
    expect(await getEarningRule('vip.points.postDay')).toBe(12)
    expect(await prisma.siteSetting.findUnique({ where: { key: 'vip.points.courseComplete' } })).toBeNull()
    expect((await call(adminSettings.PUT, req('/x', { method: 'PUT', body: { 'vip.points.lessonComplete': -1 } }))).status).toBe(400)
    const fit = await call(adminFitSettings.PUT, req('/x', { method: 'PUT', body: { 'vip.fitness.points.streak7': 150 } }))
    expect(fit.status).toBe(200)
    expect((await fit.json())['vip.fitness.points.streak7']).toBe(150)
    expect(await getEarningRule('vip.points.streak7')).toBe(150)
  })

  it('the member How-to-earn table is the registry: same rules, same live values, 0 = hidden', async () => {
    await prisma.siteSetting.createMany({ data: [{ key: 'vip.points.workout', value: '33' }, { key: 'vip.points.postDay', value: '0' }] })
    const rules = await getEarningRules()
    const rows = earningTable(rules, 'PLUS', [])
    const byKey = new Map(rows.map((r) => [r.key, r]))
    for (const r of EARNING_RULES) {
      if (!('member' in r)) continue
      if (rules[r.key] === 0) expect(byKey.has(r.key), r.key).toBe(false)
      else expect(byKey.get(r.key)?.action, r.key).toBe(r.member)
    }
    expect(byKey.get('vip.points.workout')?.points).toBe('33 pts')
    expect(byKey.get('vip.points.purchaseBaseBps')?.points).toBe('7.5% back')
  })
})

describe('Academy points: exactly once in total', () => {
  it('a lesson re-marked, un-marked and re-marked pays once; the course pays once', async () => {
    const m = await makeUser({ tag: 'int-lesson', tier: 'CLUB' })
    asAdmin()
    const post = async (body: Record<string, unknown>) => (await (await call(adminClassroom.POST, req('/x', { body }))).json()).id as string
    const course = await post({ op: 'course.upsert', title: 'ZZ int course', slug: `zz-int-${uniq()}`, minTier: 'CLUB', published: true })
    const mod = await post({ op: 'module.upsert', courseId: course, title: 'ZZ m' })
    const lesson = await post({ op: 'lesson.upsert', moduleId: mod, title: 'ZZ l', body: 'zz', minTier: null, published: true })
    setSession(m)
    const hit = () => call(progress.POST, req(`/api/vip/lessons/${lesson}/progress`, { method: 'POST' }), { id: lesson })
    // (Concurrent awards of one key are covered in points.test.ts.)
    for (let i = 0; i < 3; i++) await hit()
    await call(progress.DELETE, req('/x', { method: 'DELETE' }), { id: lesson })
    await hit()
    expect(await keyed(`lesson:${lesson}:${m.id}`)).toBe(1)
    expect(await keyed(`course:${course}:${m.id}`)).toBe(1)
    expect(await pointsBalance(m.id)).toBe(50 + 500)
  })
})

describe('mark-paid + order PATCH: purchase points, referral and training invoices — each once', () => {
  it('a member’s goods order earns tier points once, whichever path confirms it', async () => {
    const m = await makeUser({ tag: 'int-paid', tier: 'PREMIUM' })
    const a = await prisma.order.create({ data: { orderNumber: `ZZ-${uniq()}`, email: m.email, userId: m.id, subtotal: 10000, total: 10000, paymentMethod: 'zelle' } })
    asAdmin()
    // PATCH path first, then mark-paid (already paid → no second pipeline).
    expect((await orderPATCH(req(`/api/admin/orders/${a.id}`, { method: 'PATCH', body: { paymentStatus: 'PAID' } }), params({ id: a.id }))).status).toBe(200)
    expect((await (await markPaidPOST(req('/x', { method: 'POST' }), params({ id: a.id }))).json()).alreadyPaid).toBe(true)
    expect(await keyed(`purchase:${a.id}`)).toBe(1)
    expect(await pointsBalance(m.id)).toBe(1000) // 10% of $100 on Premium Stacks

    const b = await prisma.order.create({ data: { orderNumber: `ZZ-${uniq()}`, email: m.email, userId: m.id, subtotal: 5000, total: 5000, paymentMethod: 'zelle' } })
    await Promise.all([1, 2].map(() => markPaidPOST(req('/x', { method: 'POST' }), params({ id: b.id }))))
    expect(await keyed(`purchase:${b.id}`)).toBe(1)
    expect(await pointsBalance(m.id)).toBe(1500)
  })

  it('a training invoice opens the course once and earns no purchase points', async () => {
    const m = await makeUser({ tag: 'int-train', tier: 'CLUB' })
    const course = await prisma.vipCourse.create({ data: { title: 'ZZ paid training', slug: `zz-paid-${uniq()}`, published: true, purchaseOnly: true, priceCents: 4900 } })
    const inv = await prisma.order.create({
      data: { orderNumber: `ZZ-${uniq()}`, email: m.email, userId: m.id, subtotal: 4900, total: 4900, paymentMethod: 'zelle', notes: trainingNote(course.id, m.id) },
    })
    asAdmin()
    await Promise.all([1, 2].map(() => markPaidPOST(req('/x', { method: 'POST' }), params({ id: inv.id }))))
    expect(await hasCourseGrant(m.id, course.id)).toBe(true)
    expect(await prisma.vipCourseGrant.count({ where: { userId: m.id, courseId: course.id } })).toBe(1)
    expect(await keyed(`purchase:${inv.id}`)).toBe(0)
  })

  it('a TRAINING reward for a purchase-only course is redeemable, and an existing grant blocks it (one grant table)', async () => {
    const m = await makeUser({ tag: 'int-reward-train', tier: 'PREMIUM' })
    const course = await prisma.vipCourse.create({ data: { title: 'ZZ reward training', slug: `zz-rt-${uniq()}`, published: true, purchaseOnly: true, minTier: 'CLUB' } })
    const item = await prisma.vipRewardItem.create({ data: { slug: `zz-rt-${uniq()}`, kind: 'TRAINING', title: 'ZZ training reward', pointsCost: 1000, courseId: course.id, active: true } })
    await awardPoints({ userId: m.id, points: 3000, type: 'EARN_ADMIN', description: 'zz', idempotencyKey: `zz-int-${uniq()}` })
    // Premium tier alone does NOT open a purchase-only course → the reward is usable.
    await redeemReward({ userId: m.id, accessTier: 'PREMIUM', itemId: item.id, clickKey: `zz-${uniq()}` })
    expect(await hasCourseGrant(m.id, course.id)).toBe(true)
    await expect(redeemReward({ userId: m.id, accessTier: 'PREMIUM', itemId: item.id, clickKey: `zz-${uniq()}` })).rejects.toMatchObject({ code: 'already_unlocked' })
    // grant writes are idempotent from every source
    expect((await grantTrainingAccess(m.id, course.id, 'admin')).created).toBe(false)
  })
})

describe('one leaderboard switch', () => {
  it('the fitness toggle and the rewards toggle are the same preference', async () => {
    const m = await makeUser({ tag: 'int-lb', tier: 'CLUB' })
    setSession(m)
    expect((await call(fitPrefs.PATCH, req('/x', { method: 'PATCH', body: { hideFromLeaderboards: true } }))).status).toBe(200)
    expect(await isHiddenFromLeaderboards(m.id)).toBe(true)
    expect((await (await call(rewardsPrefs.GET, req('/x'))).json()).hideFromLeaderboards).toBe(true)
    expect((await call(rewardsPrefs.PATCH, req('/x', { method: 'PATCH', body: { hideFromLeaderboards: false } }))).status).toBe(200)
    expect((await getFitnessPrefs(m.id)).hideFromLeaderboards).toBe(false)
    // the fitness column is no longer written
    expect((await prisma.vipFitnessProfile.findUnique({ where: { userId: m.id } }))?.hideFromLeaderboards ?? false).toBe(false)
  })
})

describe('live-session attendance', () => {
  it('the Join button pays the event rule once while live, nothing before, and forwards to the link', async () => {
    const m = await makeUser({ tag: 'int-event', tier: 'CLUB' })
    const live = await prisma.vipEvent.create({ data: { title: 'ZZ live', startsAt: new Date(Date.now() - 10 * 60e3), published: true, joinUrl: 'https://meet.example.invalid/zz' } })
    const later = await prisma.vipEvent.create({ data: { title: 'ZZ later', startsAt: new Date(Date.now() + 86400e3), published: true, joinUrl: 'https://meet.example.invalid/zz2' } })
    setSession(m)
    const r1 = await call(eventJoin.GET, req(`/api/vip/events/${live.id}/join`), { id: live.id })
    expect(r1.status).toBe(303)
    expect(r1.headers.get('location')).toBe('https://meet.example.invalid/zz')
    await call(eventJoin.GET, req(`/api/vip/events/${live.id}/join`), { id: live.id })
    expect(await keyed(`event:${live.id}:${m.id}`)).toBe(1)
    expect(await pointsBalance(m.id)).toBe(100)
    expect((await call(eventJoin.GET, req(`/api/vip/events/${later.id}/join`), { id: later.id })).status).toBe(303)
    expect(await keyed(`event:${later.id}:${m.id}`)).toBe(0)
    // tier-gated event: no link, no points
    const premium = await prisma.vipEvent.create({ data: { title: 'ZZ premium', startsAt: new Date(), minTier: 'PREMIUM', published: true, joinUrl: 'https://meet.example.invalid/p' } })
    expect((await call(eventJoin.GET, req(`/api/vip/events/${premium.id}/join`), { id: premium.id })).status).toBe(403)
  })
})

describe('admin images for clubhouse content', () => {
  it('fitness content accepts an uploaded clubhouse image or https, never plain http', async () => {
    asAdmin()
    const make = (imageUrl: string) =>
      call(adminFitExercises.POST, req('/x', { body: { op: 'exercise.upsert', name: `ZZ img ${uniq()}`, muscleGroups: [], equipment: [], measure: 'WEIGHT_REPS', instructions: '', published: false, imageUrl } }))
    expect((await make('/api/vip/media/2026-11/0b6f0aa6-1e2f-4c7e-9a51-6a0d1c2e3f41.jpg')).status).toBeLessThan(300)
    expect((await make('https://images.example.invalid/zz.jpg')).status).toBeLessThan(300)
    expect((await make('http://images.example.invalid/zz.jpg')).status).toBe(400)
  })
})

describe('dashboard', () => {
  it('community card: people you follow, else the latest; fitness + rewards cards load', async () => {
    const me = await makeUser({ tag: 'int-dash', tier: 'CLUB' })
    const friend = await makeUser({ tag: 'int-dash-friend', tier: 'CLUB' })
    const stranger = await makeUser({ tag: 'int-dash-stranger', tier: 'CLUB' })
    await prisma.vipPost.create({ data: { authorId: friend.id, body: 'zz friend post' } })
    await prisma.vipPost.create({ data: { authorId: stranger.id, body: 'zz stranger post' } })
    const v = (await loadVipViewer(me.id))!
    let d = await loadDashboard(v)
    expect(d.postsSource).toBe('latest')
    await prisma.vipFollow.create({ data: { followerId: me.id, followingId: friend.id } })
    d = await loadDashboard(v)
    expect(d.postsSource).toBe('following')
    expect(d.posts.every((p) => p.author.id === friend.id)).toBe(true)
    expect(d.fitness).toMatchObject({ checkedInToday: false, workout: null })
    expect(Array.isArray(d.rewards)).toBe(true)
  })
})
