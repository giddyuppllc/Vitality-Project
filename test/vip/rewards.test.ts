import { beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMemberRewards, periodFor } from '@/lib/vip/rewards'
import { GET as cronGET } from '@/app/api/cron/vip-member-rewards/route'
import * as adminRewards from '@/app/api/admin/vip/rewards/route'
import { makeUser, req, setSession } from '../helpers'

async function resetRewardState() {
  await prisma.vipRewardGrant.deleteMany({})
  await prisma.vipTierReward.deleteMany({})
  await prisma.storeCreditTxn.deleteMany({ where: { type: 'MEMBER_REWARD' } })
}

describe('monthly member rewards (store credit)', () => {
  beforeEach(resetRewardState)

  it('DEFAULT OFF: with no settings nothing is granted', async () => {
    const m = await makeUser({ tag: 'rw-off', tier: 'PREMIUM' })
    const r = await runMemberRewards()
    expect(r.granted).toBe(0)
    expect(r.totalCents).toBe(0)
    expect(r.off).toBe(r.examined)
    expect(await prisma.storeCredit.findUnique({ where: { userId: m.id } })).toBeNull()
    expect(await prisma.storeCreditTxn.count({ where: { type: 'MEMBER_REWARD' } })).toBe(0)
  })

  it('grants per tier into the StoreCredit ledger; run twice → exactly one grant', async () => {
    const plus = await makeUser({ tag: 'rw-plus', tier: 'PLUS' })
    const club = await makeUser({ tag: 'rw-club', tier: 'CLUB' })
    const pastDue = await makeUser({ tag: 'rw-pastdue', tier: 'PLUS', status: 'PAST_DUE' })
    // admin sets PLUS only (test amount, not a business value)
    const admin = await makeUser({ tag: 'rw-admin', role: 'ADMIN' })
    setSession(admin)
    const put = await adminRewards.PUT(req('/api/admin/vip/rewards', { method: 'PUT', body: { CLUB: 0, PLUS: 1234, PREMIUM: 0 } }))
    expect(put.status).toBe(200)

    const now = new Date('2026-10-05T12:00:00Z')
    const first = await runMemberRewards({ now })
    const second = await runMemberRewards({ now })

    const grants = await prisma.vipRewardGrant.findMany({ where: { userId: plus.id } })
    expect(grants).toHaveLength(1)
    expect(grants[0].period).toBe('2026-10')
    expect(grants[0].amountCents).toBe(1234)
    expect(second.granted).toBe(0)
    expect(second.alreadyGranted).toBeGreaterThanOrEqual(1)
    expect(first.granted).toBeGreaterThanOrEqual(1)

    const credit = await prisma.storeCredit.findUniqueOrThrow({ where: { userId: plus.id }, include: { transactions: true } })
    expect(credit.balance).toBe(1234)
    expect(credit.transactions).toHaveLength(1)
    expect(credit.transactions[0].type).toBe('MEMBER_REWARD')
    expect(credit.transactions[0].description).toBe('VIP monthly member reward (Plus, 2026-10)')
    expect(grants[0].storeCreditTxnId).toBe(credit.transactions[0].id)

    expect(await prisma.vipRewardGrant.count({ where: { userId: club.id } })).toBe(0) // CLUB = 0 = off
    expect(await prisma.vipRewardGrant.count({ where: { userId: pastDue.id } })).toBe(0) // not ACTIVE
  })

  it('concurrent runs still grant once (unique key is the guard)', async () => {
    const m = await makeUser({ tag: 'rw-race', tier: 'PREMIUM' })
    await prisma.vipTierReward.create({ data: { tier: 'PREMIUM', monthlyCreditCents: 500 } })
    const now = new Date('2026-11-02T00:00:00Z')
    await Promise.all([runMemberRewards({ now }), runMemberRewards({ now }), runMemberRewards({ now })])
    expect(await prisma.vipRewardGrant.count({ where: { userId: m.id } })).toBe(1)
    const c = await prisma.storeCredit.findUniqueOrThrow({ where: { userId: m.id } })
    expect(c.balance).toBe(500)
  })

  it('a new month grants again; dry run writes nothing', async () => {
    const m = await makeUser({ tag: 'rw-months', tier: 'CLUB' })
    await prisma.vipTierReward.create({ data: { tier: 'CLUB', monthlyCreditCents: 100 } })
    await runMemberRewards({ now: new Date('2026-12-31T23:59:00Z') })
    const dry = await runMemberRewards({ now: new Date('2027-01-01T00:01:00Z'), dryRun: true })
    expect(dry.decisions?.find((d) => d.userId === m.id)?.outcome).toBe('would_grant')
    expect(await prisma.vipRewardGrant.count({ where: { userId: m.id } })).toBe(1)
    await runMemberRewards({ now: new Date('2027-01-01T00:01:00Z') })
    const periods = (await prisma.vipRewardGrant.findMany({ where: { userId: m.id } })).map((g) => g.period).sort()
    expect(periods).toEqual(['2026-12', '2027-01'])
    expect(periodFor(new Date('2027-01-01T00:01:00Z'))).toBe('2027-01')
  })

  it('cron endpoint: 403 without the secret (when set), runs with it, logs a CronRun', async () => {
    process.env.CRON_SECRET = 'zz-test-cron-secret'
    try {
      const denied = await cronGET(new NextRequest('http://vitalityproject.global/api/cron/vip-member-rewards'))
      expect(denied.status).toBe(403)
      const ok = await cronGET(
        new NextRequest('http://vitalityproject.global/api/cron/vip-member-rewards', {
          headers: { authorization: 'Bearer zz-test-cron-secret' },
        }),
      )
      expect(ok.status).toBe(200)
      const body = await ok.json()
      expect(body.ok).toBe(true)
      const run = await prisma.cronRun.findFirst({ where: { job: 'VIP member rewards' }, orderBy: { startedAt: 'desc' } })
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
