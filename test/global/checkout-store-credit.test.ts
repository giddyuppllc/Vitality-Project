import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST as checkoutPOST } from '@/app/api/checkout/route'
import { runMemberRewards } from '@/lib/vip/rewards'
import { makeUser, req, setSession } from '../helpers'

/**
 * Regression guard for vitalityproject.global: the store's own checkout still
 * spends store credit — including credit deposited by the clubhouse reward
 * job — through the unchanged api/checkout useStoreCredit path.
 *
 * Fixture product is obviously fake (ZZ-TEST, $10) and exists only in the
 * throwaway DB.
 */
describe('.global checkout still applies store credit', () => {
  it('a MEMBER_REWARD deposit is spent at checkout (CHECKOUT_APPLY debit, order.storeCreditUsed)', async () => {
    const member = await makeUser({ tag: 'checkout', tier: 'CLUB' })
    await prisma.vipRewardGrant.deleteMany({})
    await prisma.vipTierReward.upsert({
      where: { tier: 'CLUB' },
      update: { monthlyCreditCents: 100_000 },
      create: { tier: 'CLUB', monthlyCreditCents: 100_000 },
    })
    await runMemberRewards({ now: new Date('2031-01-15T00:00:00Z') })
    await prisma.vipTierReward.update({ where: { tier: 'CLUB' }, data: { monthlyCreditCents: 0 } })
    expect((await prisma.storeCredit.findUniqueOrThrow({ where: { userId: member.id } })).balance).toBe(100_000)

    const product = await prisma.product.create({
      data: {
        name: 'ZZ-TEST fixture item',
        description: 'Test fixture (throwaway DB only)',
        slug: `zz-test-fixture-${Date.now()}`,
        price: 1000,
        status: 'ACTIVE',
        trackInventory: false,
      },
    })

    setSession(member)
    const res = await checkoutPOST(
      req('/api/checkout', {
        body: {
          items: [{ productId: product.id, quantity: 1 }],
          email: member.email,
          shippingAddress: { name: 'ZZ Test', line1: '1 Test St', city: 'Testville', state: 'AZ', zip: '85001', country: 'US' },
          useStoreCredit: true,
          card: { number: '4111111111111111', expMonth: '12', expYear: '2035', cvv: '123', name: 'ZZ Test', zip: '85001' },
        },
      }),
    )
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)

    const order = await prisma.order.findFirstOrThrow({ where: { userId: member.id }, orderBy: { createdAt: 'desc' } })
    expect(order.storeCreditUsed).toBeGreaterThan(0)
    expect(order.total).toBe(0) // fully covered by credit → no card charge attempted

    const credit = await prisma.storeCredit.findUniqueOrThrow({
      where: { userId: member.id },
      include: { transactions: { orderBy: { createdAt: 'asc' } } },
    })
    expect(credit.balance).toBe(100_000 - order.storeCreditUsed)
    expect(credit.transactions.map((t) => t.type)).toEqual(['MEMBER_REWARD', 'CHECKOUT_APPLY'])
    expect(credit.transactions[1].amount).toBe(-order.storeCreditUsed)
    expect(credit.transactions[1].orderId).toBe(order.id)
  })
})
