import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pointsToDiscountCents, tierForLifetimeSpend } from '@/lib/loyalty'

// Customer-facing loyalty summary. Used by the checkout page to render the
// "Use loyalty points" redemption UI without re-fetching the heavier
// /account/credits view.
//
// Returns: current balance, lifetime spend + tier, the cap on redeemable
// points at this moment, and the dollar value those points are worth.
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  }

  const account = await prisma.loyaltyAccount.findUnique({
    where: { userId: session.user.id },
    select: { points: true, lifetimeSpend: true, tier: true },
  })

  const points = account?.points ?? 0
  const lifetimeSpend = account?.lifetimeSpend ?? 0
  const tier = account?.tier ?? tierForLifetimeSpend(lifetimeSpend)
  const maxDiscountCents = pointsToDiscountCents(points)

  return NextResponse.json({
    points,
    lifetimeSpend,
    tier,
    maxDiscountCents,
    centsPerPoint: 1,
  })
}
