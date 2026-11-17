import { prisma } from '@/lib/prisma'

/**
 * "Hide me from leaderboards" — ONE preference for every board in the
 * clubhouse (the rewards points board, fitness challenge boards, badges).
 *
 * Source of truth: `VipProfile.hideFromLeaderboards`. The fitness branch also
 * added `VipFitnessProfile.hideFromLeaderboards`; that column stays in the
 * schema (additive-only) but is neither read nor written any more. Every
 * board and both preference APIs (/api/vip/rewards/prefs and the fitness
 * prefs API) go through this module.
 */
export async function isHiddenFromLeaderboards(userId: string): Promise<boolean> {
  const p = await prisma.vipProfile.findUnique({ where: { userId }, select: { hideFromLeaderboards: true } })
  return p?.hideFromLeaderboards ?? false
}

export async function setHiddenFromLeaderboards(userId: string, hidden: boolean): Promise<void> {
  await prisma.vipProfile.upsert({
    where: { userId },
    update: { hideFromLeaderboards: hidden },
    create: { userId, hideFromLeaderboards: hidden },
  })
}
