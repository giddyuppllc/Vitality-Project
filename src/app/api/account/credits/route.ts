import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIER_THRESHOLDS, tierForLifetimeSpend } from '@/lib/loyalty'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [loyalty, storeCredit] = await Promise.all([
    prisma.loyaltyAccount.findUnique({
      where: { userId: session.user.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
    }),
    prisma.storeCredit.findUnique({
      where: { userId: session.user.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
    }),
  ])

  const lifetimeSpend = loyalty?.lifetimeSpend ?? 0
  const tier = tierForLifetimeSpend(lifetimeSpend)

  return NextResponse.json({
    loyalty: {
      points: loyalty?.points ?? 0,
      tier,
      lifetimeSpend,
      thresholds: TIER_THRESHOLDS,
      transactions: loyalty?.transactions ?? [],
    },
    storeCredit: {
      balance: storeCredit?.balance ?? 0,
      transactions: storeCredit?.transactions ?? [],
    },
  })
}
