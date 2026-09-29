import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authorSelect, toAuthor, type AuthorView } from './feed'

/**
 * Member directory + profile read models. Only people who can open the
 * clubhouse are listed (ACTIVE paid membership, or the admin team), minus
 * anyone suspended from the community. Profiles are members-only: callers
 * gate with requireVipPage/requireVipApi — there are no public profiles.
 */

const memberWhere: Prisma.UserWhereInput = {
  OR: [{ role: 'ADMIN' }, { membership: { status: 'ACTIVE', tier: { not: 'NONE' } } }],
  NOT: { vipProfile: { suspendedAt: { not: null } } },
}

export interface MemberCard extends AuthorView {
  bio: string | null
  joinedAt: string | null
}

const cardSelect = {
  ...authorSelect,
  createdAt: true,
  vipProfile: { select: { displayName: true, avatarUrl: true, bio: true } },
  membership: { select: { tier: true, status: true, startedAt: true, paymentConfirmedAt: true } },
} satisfies Prisma.UserSelect

type CardRow = Prisma.UserGetPayload<{ select: typeof cardSelect }>

function toCard(u: CardRow): MemberCard {
  const joined = u.membership?.paymentConfirmedAt ?? u.membership?.startedAt ?? null
  return {
    ...toAuthor(u),
    bio: u.vipProfile?.bio ?? null,
    joinedAt: joined ? joined.toISOString() : null,
  }
}

export async function listMembers(q: string | null | undefined): Promise<MemberCard[]> {
  const term = q?.trim().slice(0, 60)
  const where: Prisma.UserWhereInput = term
    ? {
        AND: [
          memberWhere,
          {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { username: { contains: term, mode: 'insensitive' } },
              { vipProfile: { displayName: { contains: term, mode: 'insensitive' } } },
            ],
          },
        ],
      }
    : memberWhere
  const rows = await prisma.user.findMany({
    where,
    select: cardSelect,
    orderBy: { createdAt: 'asc' },
    take: 200,
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
