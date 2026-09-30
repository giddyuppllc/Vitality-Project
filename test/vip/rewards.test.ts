import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  DEFAULT_TIER_REWARD_CENTS,
  expirableRewardCents,
  expireRewardCredit,
  periodFor,
  rewardEligibility,
  runMemberRewards,
  upcomingRewardExpiries,
} from '@/lib/vip/rewards'
import { GET as cronGET } from '@/app/api/cron/vip-member-rewards/route'
import * as adminRewards from '@/app/api/admin/vip/rewards/route'
import { makeUser, req, setSession } from '../helpers'

async function resetRewardState() {
  await prisma.vipRewardGrant.deleteMany({})
  await prisma.vipTierReward.deleteMany({})
  await prisma.siteSetting.deleteMany({ where: { key: { startsWith: 'vip.' } } })
  vi.mocked(sendEmail).mockClear()
}

const FIRST = new Date('2026-10-01T06:00:00Z')
const bal = async (userId: string) => (await prisma.storeCredit.findUnique({ where: { userId } }))?.balance ?? 0

describe('monthly member rewards (store credit)', () => {
  beforeEach(resetRewardState)

  it('DEFAULTS: Club $5 / Plus $20 / Premium Stacks $50 on the 1st, with no admin rows saved', async () => {
    expect(DEFAULT_TIER_REWARD_CENTS).toEqual({ CLUB: 500, PLUS: 2000, PREMIUM: 5000 })
    const club = await makeUser({ tag: 'rw-d-club', tier: 'CLUB' })
    const plus = await makeUser({ tag: 'rw-d-plus', tier: 'PLUS' })
    const prem = await makeUser({ tag: 'rw-d-prem', tier: 'PREMIUM' })
    const r = await runMemberRewards({ now: FIRST })
    expect(r.skipped).toBeUndefined()
    expect(await bal(club.id)).toBe(500)
    expect(await bal(plus.id)).toBe(2000)
    expect(await bal(prem.id)).toBe(5000)
    const txn = await prisma.storeCreditTxn.findFirstOrThrow({ where: { credit: { userId: plus.id }, type: 'MEMBER_REWARD' } })
    expect(txn.description).toBe('VIP monthly member reward (Plus, 2026-10)')
    const grant = await prisma.vipRewardGrant.findFirstOrThrow({ where: { userId: plus.id } })
    expect(grant.storeCreditTxnId).toBe(txn.id)
  })

  it('only the 1st grants; other days grant nothing unless catchUp', async () => {
    const m = await makeUser({ tag: 'rw-day', tier: 'CLUB' })
    const mid = new Date('2026-10-15T12:00:00Z')
    const r = await runMemberRewards({ now: mid })
    expect(r.skipped).toBe('not_first_of_month')
    expect(r.granted).toBe(0)
    expect(await bal(m.id)).toBe(0)
    const caught = await runMemberRewards({ now: mid, catchUp: true })
    expect(caught.granted).toBeGreaterThanOrEqual(1)
    expect((await prisma.vipRewardGrant.findFirstOrThrow({ where: { userId: m.id } })).period).toBe('2026-10')
  })

  it('eligibility: ACTIVE only; past-due / paused / cancelled / pending and community-suspended members get nothing', async () => {
    const ok = await makeUser({ tag: 'rw-e-ok', tier: 'PLUS' })
    const pastDue = await makeUser({ tag: 'rw-e-pd', tier: 'PLUS', status: 'PAST_DUE' })
    const paused = await makeUser({ tag: 'rw-e-pa', tier: 'PLUS', status: 'PAUSED' })
    const cancelled = await makeUser({ tag: 'rw-e-ca', tier: 'PLUS', status: 'CANCELLED' })
    const pending = await makeUser({ tag: 'rw-e-pe', tier: 'PLUS', status: 'PENDING_PAYMENT' })
    const suspended = await makeUser({ tag: 'rw-e-su', tier: 'PREMIUM', suspended: true })
    const none = await makeUser({ tag: 'rw-e-none' })

    const r = await runMemberRewards({ now: FIRST })
    expect(r.suspended).toBeGreaterThanOrEqual(1)
    expect(await bal(ok.id)).toBe(2000)
    for (const u of [pastDue, paused, cancelled, pending, suspended, none]) {
      expect(await prisma.vipRewardGrant.count({ where: { userId: u.id } })).toBe(0)
      expect(await bal(u.id)).toBe(0)
    }
    expect((await rewardEligibility(ok.id)).eligible).toBe(true)
    expect(await rewardEligibility(pastDue.id)).toMatchObject({ eligible: false, reason: 'status_past_due' })
    expect(await rewardEligibility(suspended.id)).toMatchObject({ eligible: false, reason: 'suspended' })
    expect(await rewardEligibility(none.id)).toMatchObject({ eligible: false, reason: 'no_membership' })
  })

  it('admin amounts override the defaults; 0 turns a tier off; run twice → exactly one grant', async () => {
    const plus = await makeUser({ tag: 'rw-plus', tier: 'PLUS' })
    const club = await makeUser({ tag: 'rw-club', tier: 'CLUB' })
    const admin = await makeUser({ tag: 'rw-admin', role: 'ADMIN' })
    setSession(admin)
    const put = await adminRewards.PUT(req('/api/admin/vip/rewards', { method: 'PUT', body: { CLUB: 0, PLUS: 1234, PREMIUM: 5000 } }))
    expect(put.status).toBe(200)

    const first = await runMemberRewards({ now: FIRST })
    const second = await runMemberRewards({ now: FIRST })
    expect(first.granted).toBeGreaterThanOrEqual(1)
    expect(second.granted).toBe(0)
    expect(second.alreadyGranted).toBeGreaterThanOrEqual(1)
    expect(await prisma.vipRewardGrant.count({ where: { userId: plus.id } })).toBe(1)
    expect(await bal(plus.id)).toBe(1234)
    expect(await prisma.vipRewardGrant.count({ where: { userId: club.id } })).toBe(0) // CLUB = 0 = off
  })

  it('concurrent runs still grant once (unique key is the guard)', async () => {
    const m = await makeUser({ tag: 'rw-race', tier: 'PREMIUM' })
    await Promise.all([runMemberRewards({ now: FIRST }), runMemberRewards({ now: FIRST }), runMemberRewards({ now: FIRST })])
    expect(await prisma.vipRewardGrant.count({ where: { userId: m.id } })).toBe(1)
    expect(await bal(m.id)).toBe(5000)
  })

  it('a new month grants again; dry run writes nothing', async () => {
    const m = await makeUser({ tag: 'rw-months', tier: 'CLUB' })
    await runMemberRewards({ now: new Date('2026-12-01T00:01:00Z') })
    const dry = await runMemberRewards({ now: new Date('2027-01-01T00:01:00Z'), dryRun: true })
    expect(dry.decisions?.find((d) => d.userId === m.id)?.outcome).toBe('would_grant')
    expect(await prisma.vipRewardGrant.count({ where: { userId: m.id } })).toBe(1)
    await runMemberRewards({ now: new Date('2027-01-01T00:01:00Z') })
    const periods = (await prisma.vipRewardGrant.findMany({ where: { userId: m.id } })).map((g) => g.period).sort()
    expect(periods).toEqual(['2026-12', '2027-01'])
    expect(periodFor(new Date('2027-01-01T00:01:00Z'))).toBe('2027-01')
  })

  it('emails the reward notice through the store mailer (Reply-To vital@), honouring the member preference', async () => {
    const on = await makeUser({ tag: 'rw-mail-on', tier: 'PLUS' })
    const off = await makeUser({ tag: 'rw-mail-off', tier: 'PLUS' })
    await prisma.vipProfile.create({ data: { userId: off.id, emailRewards: false } })
    await runMemberRewards({ now: FIRST })
    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0])
    const mine = calls.find((c) => c.to === on.email)
    expect(mine?.subject).toBe('Your $20 Clubhouse credit just landed')
    expect(mine?.replyTo).toBe('vital@vitalityproject.global')
    expect(mine?.html).toContain('October 2026')
    expect(mine?.html).toContain('September 30, 2027') // 12-month expiry, last day
    expect(calls.find((c) => c.to === off.email)).toBeUndefined()
    // dry run never emails
    vi.mocked(sendEmail).mockClear()
    await runMemberRewards({ now: new Date('2026-11-01T00:00:00Z'), dryRun: true })
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
  })

  it('holds the reward notice while vitalityproject.vip has no DNS, then sends it once on a later day of the month', async () => {
    const live = (globalThis as unknown as { __vipDomainLive: { value: boolean } }).__vipDomainLive
    const m = await makeUser({ tag: 'rw-held', tier: 'PREMIUM' })
    const off = await makeUser({ tag: 'rw-held-off', tier: 'PLUS' })
    await prisma.vipProfile.create({ data: { userId: off.id, emailRewards: false } })
    const mine = () => vi.mocked(sendEmail).mock.calls.filter((c) => c[0].to === m.email)
    try {
      live.value = false
      const first = await runMemberRewards({ now: FIRST })
      expect(await bal(m.id)).toBe(5000) // the credit itself is never held
      expect(first.emailed).toBe(0)
      expect(mine()).toHaveLength(0)
      expect((await prisma.vipRewardGrant.findFirstOrThrow({ where: { userId: m.id } })).noticeAt).toBeNull()
      // opted out: handled without sending, even while held
      expect((await prisma.vipRewardGrant.findFirstOrThrow({ where: { userId: off.id } })).noticeAt).not.toBeNull()

      live.value = true
      const later = await runMemberRewards({ now: new Date('2026-10-04T00:15:00Z') })
      expect(later.skipped).toBe('not_first_of_month')
      expect(mine()).toHaveLength(1)
      expect(mine()[0][0].subject).toBe('Your $50 Clubhouse credit just landed')
      expect((await prisma.vipRewardGrant.findFirstOrThrow({ where: { userId: m.id } })).noticeAt).not.toBeNull()
      expect(vi.mocked(sendEmail).mock.calls.filter((c) => c[0].to === off.email)).toHaveLength(0)

      await runMemberRewards({ now: new Date('2026-10-05T00:15:00Z') })
      expect(mine()).toHaveLength(1)
      expect(await bal(m.id)).toBe(5000)
    } finally {
      live.value = true
    }
  })

  it('overlapping runs send a held notice once (the noticeAt claim is the guard)', async () => {
    const live = (globalThis as unknown as { __vipDomainLive: { value: boolean } }).__vipDomainLive
    const m = await makeUser({ tag: 'rw-overlap', tier: 'PLUS' })
    try {
      live.value = false
      await runMemberRewards({ now: FIRST })
    } finally {
      live.value = true
    }
    const day = new Date('2026-10-02T00:15:00Z')
    await Promise.all([runMemberRewards({ now: day }), runMemberRewards({ now: day }), runMemberRewards({ now: day })])
    expect(vi.mocked(sendEmail).mock.calls.filter((c) => c[0].to === m.email)).toHaveLength(1)
  })

  it('a failed send releases its claim; a notice from an earlier month is never sent late', async () => {
    const m = await makeUser({ tag: 'rw-retry', tier: 'CLUB' })
    const real = vi.mocked(sendEmail).getMockImplementation()!
    vi.mocked(sendEmail).mockImplementation(async (a) => (a.to === m.email ? ({ success: false, error: 'boom' } as never) : real(a)))
    try {
      await runMemberRewards({ now: FIRST })
    } finally {
      vi.mocked(sendEmail).mockImplementation(real)
    }
    const mine = () => vi.mocked(sendEmail).mock.calls.filter((c) => c[0].to === m.email)
    expect(mine()).toHaveLength(1)
    expect((await prisma.vipRewardGrant.findFirstOrThrow({ where: { userId: m.id } })).noticeAt).toBeNull()
    // next month: October's unsent notice is left alone; November's goes out
    await runMemberRewards({ now: new Date('2026-11-01T00:15:00Z') })
    const subjects = mine().map((c) => c[0].html)
    expect(subjects).toHaveLength(2)
    expect(subjects[1]).toContain('November 2026')
    expect((await prisma.vipRewardGrant.findFirstOrThrow({ where: { userId: m.id, period: '2026-10' } })).noticeAt).toBeNull()
  })

  it('cron endpoint: 403 without the secret (when set), runs with it, logs a CronRun', async () => {
    process.env.CRON_SECRET = 'zz-test-cron-secret'
    try {
      const denied = await cronGET(new NextRequest('http://vitalityproject.global/api/cron/vip-member-rewards'))
      expect(denied.status).toBe(403)
      const ok = await cronGET(
        new NextRequest('http://vitalityproject.global/api/cron/vip-member-rewards?dryRun=1', {
          headers: { authorization: 'Bearer zz-test-cron-secret' },
        }),
      )
      expect(ok.status).toBe(200)
      const body = await ok.json()
      expect(body.ok).toBe(true)
      const run = await prisma.cronRun.findFirst({ where: { job: 'VIP member rewards (dry run)' }, orderBy: { startedAt: 'desc' } })
      expect(run?.status).toBe('OK')
    } finally {
      delete process.env.CRON_SECRET
    }
  })

  it('admin settings reject negatives / non-integers', async () => {
    const admin = await makeUser({ tag: 'rw-admin2', role: 'ADMIN' })
    setSession(admin)
    for (const body of [{ CLUB: -1, PLUS: 0, PREMIUM: 0 }, { CLUB: 1.5, PLUS: 0, PREMIUM: 0 }, { CLUB: 0 }]) {
      expect((await adminRewards.PUT(req('/api/admin/vip/rewards', { method: 'PUT', body }))).status).toBe(400)
    }
  })
})

describe('reward credit expiry (12 months, FIFO ledger replay)', () => {
  beforeEach(resetRewardState)

  const t = (iso: string) => new Date(iso)

  it('expirableRewardCents: spending uses the oldest credit first; other credit never expires', () => {
    const cutoff = t('2026-01-31T00:00:00Z')
    const txns = [
      { type: 'ADMIN_GRANT', amount: 1000, createdAt: t('2025-12-01T00:00:00Z') },
      { type: 'MEMBER_REWARD', amount: 500, createdAt: t('2026-01-01T00:00:00Z') },
      { type: 'MEMBER_REWARD', amount: 500, createdAt: t('2026-02-01T00:00:00Z') },
      { type: 'CHECKOUT_APPLY', amount: -1200, createdAt: t('2026-02-10T00:00:00Z') }, // 1000 grant + 200 of Jan reward
    ]
    expect(expirableRewardCents(txns, cutoff)).toBe(300) // Jan reward left: 300; Feb reward is not past cutoff
    // After expiring those 300 the replay finds nothing more (idempotent).
    expect(expirableRewardCents([...txns, { type: 'EXPIRE', amount: -300, createdAt: t('2027-01-02T00:00:00Z') }], cutoff)).toBe(0)
    // Only reward lots expire: an untouched older grant stays, and an EXPIRE line
    // is charged to the reward it expired (never to the older grant).
    const withGrant = [
      { type: 'ADMIN_GRANT', amount: 1000, createdAt: t('2025-06-01T00:00:00Z') },
      { type: 'MEMBER_REWARD', amount: 500, createdAt: t('2026-01-01T00:00:00Z') },
    ]
    expect(expirableRewardCents(withGrant, cutoff)).toBe(500)
    expect(expirableRewardCents([...withGrant, { type: 'EXPIRE', amount: -500, createdAt: t('2027-01-02T00:00:00Z') }], cutoff)).toBe(0)
    // A restore opens a fresh non-expiring lot.
    expect(
      expirableRewardCents([...txns, { type: 'CHECKOUT_RESTORE', amount: 1200, createdAt: t('2026-03-01T00:00:00Z') }], cutoff),
    ).toBe(300)
  })

  it('expires what is left of a reward 12 months after issue, exactly once, and never touches other credit', async () => {
    const m = await makeUser({ tag: 'rw-exp', tier: 'CLUB' })
    await prisma.vipTierReward.create({ data: { tier: 'CLUB', monthlyCreditCents: 500 } })
    await runMemberRewards({ now: new Date('2026-10-01T00:00:00Z'), sendEmails: false })
    const credit = await prisma.storeCredit.findUniqueOrThrow({ where: { userId: m.id } })
    // backdate the reward line to its grant date, spend $2 of it, add a non-expiring grant
    await prisma.storeCreditTxn.updateMany({ where: { creditId: credit.id, type: 'MEMBER_REWARD' }, data: { createdAt: new Date('2026-10-01T00:00:00Z') } })
    await prisma.storeCreditTxn.create({ data: { creditId: credit.id, type: 'CHECKOUT_APPLY', amount: -200, description: 'zz', createdAt: new Date('2026-11-01T00:00:00Z') } })
    await prisma.storeCreditTxn.create({ data: { creditId: credit.id, type: 'ADMIN_GRANT', amount: 1000, description: 'zz', createdAt: new Date('2026-12-01T00:00:00Z') } })
    await prisma.storeCredit.update({ where: { id: credit.id }, data: { balance: 500 - 200 + 1000 } })

    const upcoming = await upcomingRewardExpiries(m.id)
    expect(upcoming).toHaveLength(1)
    expect(upcoming[0].cents).toBe(300)
    expect(upcoming[0].expiresAt.toISOString()).toBe('2027-10-01T00:00:00.000Z')

    // (other test members' rewards are in the same DB — assert on this member)
    await expireRewardCredit({ now: new Date('2027-09-30T00:00:00Z') })
    expect(await bal(m.id)).toBe(1300)
    const dry = await expireRewardCredit({ now: new Date('2027-10-02T00:00:00Z'), dryRun: true })
    expect(dry.would?.find((w) => w.userId === m.id)?.cents).toBe(300)
    expect(await bal(m.id)).toBe(1300)

    await expireRewardCredit({ now: new Date('2027-10-02T00:00:00Z') })
    expect(await bal(m.id)).toBe(1000)
    const again = await expireRewardCredit({ now: new Date('2027-10-03T00:00:00Z') })
    expect(again.would).toBeUndefined()
    expect(await bal(m.id)).toBe(1000)
    expect(await prisma.storeCreditTxn.count({ where: { creditId: credit.id, type: 'EXPIRE' } })).toBe(1)
  })

  it('setting 0 = never expires', async () => {
    await prisma.siteSetting.create({ data: { key: 'vip.rewardExpiryMonths', value: '0' } })
    const r = await expireRewardCredit({ now: new Date('2040-01-01T00:00:00Z') })
    expect(r.months).toBe(0)
    expect(r.expiredCents).toBe(0)
  })
})
