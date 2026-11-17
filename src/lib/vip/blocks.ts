import { prisma } from '@/lib/prisma'

/**
 * Member blocks. A block works both ways: if either member blocked the other,
 * neither sees the other's posts, comments, profile or messages. No imports
 * from other clubhouse modules so the feed, notifications and messages can
 * all use it without import cycles.
 */

/** Everyone the member blocked OR who blocked the member. */
export async function blockedIdSet(userId: string): Promise<Set<string>> {
  const rows = await prisma.vipBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  const out = new Set<string>()
  for (const r of rows) out.add(r.blockerId === userId ? r.blockedId : r.blockerId)
  return out
}

export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (a === b) return false
  const n = await prisma.vipBlock.count({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  })
  return n > 0
}

/** Did `blocker` block `blocked` (one direction only)? */
export async function hasBlocked(blocker: string, blocked: string): Promise<boolean> {
  return (await prisma.vipBlock.count({ where: { blockerId: blocker, blockedId: blocked } })) > 0
}
