import { prisma } from '@/lib/prisma'
import type { Tx } from '@/lib/vip/points'

/**
 * Badges live in the shared `vip_user_badges` table (userId, badgeKey,
 * label, awardedAt; unique per member + key), so awarding is idempotent.
 */
export async function awardBadge(userId: string, badgeKey: string, label: string, tx?: Tx): Promise<void> {
  await (tx ?? prisma).vipUserBadge.upsert({
    where: { userId_badgeKey: { userId, badgeKey } },
    create: { userId, badgeKey, label: label.slice(0, 120) },
    update: {},
  })
}

export async function listBadges(userId: string) {
  return prisma.vipUserBadge.findMany({ where: { userId }, orderBy: { awardedAt: 'desc' } })
}
