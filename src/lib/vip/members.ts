import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authorSelect, toAuthor, type AuthorView } from './feed'

/**
 * Member directory + profile read models. Only people who can open the
 * clubhouse are listed (ACTIVE paid membership, or the admin team), minus
 * anyone suspended from the community. Profiles are members-only: callers
 * gate with requireVipPage/requireVipApi — there are no public profiles.
 */

export const memberWhere: Prisma.UserWhereInput = {
  OR: [{ role: 'ADMIN' }, { membership: { status: 'ACTIVE', tier: { not: 'NONE' } } }],
  NOT: { vipProfile: { suspendedAt: { not: null } } },
}

export interface MemberCard extends AuthorView {
  bio: string | null
  joinedAt: string | null
}

export const cardSelect = {
  ...authorSelect,
  createdAt: true,
  vipProfile: { select: { displayName: true, avatarUrl: true, bio: true } },
  membership: { select: { tier: true, status: true, startedAt: true, paymentConfirmedAt: true } },
} satisfies Prisma.UserSelect

export type CardRow = Prisma.UserGetPayload<{ select: typeof cardSelect }>

export function toCard(u: CardRow): MemberCard {
  const joined = u.membership?.paymentConfirmedAt ?? u.membership?.startedAt ?? null
  return {
    ...toAuthor(u),
    bio: u.vipProfile?.bio ?? null,
    joinedAt: joined ? joined.toISOString() : null,
  }
}

/**
 * Directory / member search: name, display name, username, or an interest
 * tag ("sleep" or "#sleep"). `excludeIds` drops members blocked either way.
 */
export async function listMembers(
  q: string | null | undefined,
  opts: { excludeIds?: Iterable<string>; take?: number } = {},
): Promise<MemberCard[]> {
  const term = q?.trim().replace(/^@/, '').slice(0, 60)
  const tag = term?.replace(/^#+/, '').toLowerCase()
  const exclude = [...(opts.excludeIds ?? [])]
  const and: Prisma.UserWhereInput[] = [memberWhere]
  if (exclude.length) and.push({ id: { notIn: exclude } })
  if (term) {
    and.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
        { vipProfile: { displayName: { contains: term, mode: 'insensitive' } } },
        ...(tag ? [{ vipInterests: { some: { tag: { contains: tag } } } }] : []),
      ],
    })
  }
  const rows = await prisma.user.findMany({
    where: { AND: and },
    select: cardSelect,
    orderBy: { createdAt: 'asc' },
    take: Math.min(opts.take ?? 200, 200),
  })
  return rows.map(toCard)
}

/** `idOrHandle` is a user id, or "@username" (how @mentions link). */
export async function getMemberCard(idOrHandle: string): Promise<MemberCard | null> {
  const decoded = decodeURIComponent(idOrHandle)
  const where: Prisma.UserWhereInput = decoded.startsWith('@')
    ? { AND: [memberWhere, { username: decoded.slice(1).toLowerCase() }] }
    : { AND: [memberWhere, { id: decoded }] }
  const u = await prisma.user.findFirst({ where, select: cardSelect })
  return u ? toCard(u) : null
}
