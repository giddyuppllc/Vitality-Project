import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { awardPoints, spendPoints, pointsBalance, InsufficientPointsError } from '@/lib/vip/points'
import { makeUser } from '../helpers'

describe('shared points ledger', () => {
  it('awards exactly once per idempotency key, even concurrently', async () => {
    const u = await makeUser({ tag: 'pts-once', tier: 'CLUB' })
    const key = `test:once:${u.id}`
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        awardPoints({ userId: u.id, points: 50, type: 'EARN_ENGAGEMENT', description: 'Lesson complete', idempotencyKey: key }),
      ),
    )
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1)
    expect(await pointsBalance(u.id)).toBe(50)
    const acct = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })
    expect(await prisma.loyaltyTransaction.count({ where: { accountId: acct.id } })).toBe(1)
  })

  it('never overdraws when spends race', async () => {
    const u = await makeUser({ tag: 'pts-race', tier: 'CLUB' })
    await awardPoints({ userId: u.id, points: 100, type: 'EARN_ADMIN', description: 'grant', idempotencyKey: `test:grant:${u.id}` })
    const settled = await Promise.allSettled(
      Array.from({ length: 4 }, (_, i) =>
        spendPoints({ userId: u.id, points: 60, type: 'REDEEM_REWARD', description: 'reward', idempotencyKey: `test:spend:${u.id}:${i}` }),
      ),
    )
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1)
    expect(settled.filter((s) => s.status === 'rejected' && s.reason instanceof InsufficientPointsError)).toHaveLength(3)
    expect(await pointsBalance(u.id)).toBe(40)
  })

  it('refuses non-positive amounts and wrong types', async () => {
    const u = await makeUser({ tag: 'pts-bad' })
    await expect(awardPoints({ userId: u.id, points: 0, type: 'EARN_ENGAGEMENT', description: 'x', idempotencyKey: 'k0' })).rejects.toThrow()
    await expect(awardPoints({ userId: u.id, points: 5, type: 'REDEEM_REWARD', description: 'x', idempotencyKey: 'k1' })).rejects.toThrow()
    await expect(spendPoints({ userId: u.id, points: 5, type: 'EARN_ENGAGEMENT', description: 'x' })).rejects.toThrow()
  })
})
