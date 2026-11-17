import { prisma } from '@/lib/prisma'
import type { VipViewer } from './access'
import { blockedIdSet, hasBlocked, isBlockedBetween } from './blocks'
import { cardSelect, getMemberCard, memberWhere, toCard, type MemberCard } from './members'
import { notifyFollow } from './notify'

export { blockedIdSet, isBlockedBetween, hasBlocked } from './blocks'

/**
 * The follow graph, blocks and profile privacy.
 *
 *  - Blocks work both ways: if either member blocked the other, neither sees
 *    the other's posts, comments, profile or messages, and neither can follow
 *    or message the other. Blocking also removes any follow between them.
 *  - Profile visibility: MEMBERS (default) or FOLLOWERS. A followers-only
 *    profile shows its name, photo and a Follow button to everyone else; the
 *    bio, stats, posts, activity and lists open to followers (and the team).
 *    Posts still appear in the community feed — the setting covers the profile.
 *  - Who can message: EVERYONE (default), FOLLOWING (only people this member
 *    follows) or NOBODY. Enforced in lib/vip/messages.ts.
 *
 * Callers gate with requireVipApi / requireVipPage first; nothing here checks
 * the viewer's own membership.
 */

export type ProfileVisibility = 'MEMBERS' | 'FOLLOWERS'
export type DmPolicy = 'EVERYONE' | 'FOLLOWING' | 'NOBODY'

export const PROFILE_VISIBILITY: ProfileVisibility[] = ['MEMBERS', 'FOLLOWERS']
export const DM_POLICIES: DmPolicy[] = ['EVERYONE', 'FOLLOWING', 'NOBODY']

export function readVisibility(v: string | null | undefined): ProfileVisibility {
  return v === 'FOLLOWERS' ? 'FOLLOWERS' : 'MEMBERS'
}

export function readDmPolicy(v: string | null | undefined): DmPolicy {
  return v === 'FOLLOWING' || v === 'NOBODY' ? v : 'EVERYONE'
}

export async function followingIds(userId: string): Promise<string[]> {
  const rows = await prisma.vipFollow.findMany({ where: { followerId: userId }, select: { followingId: true } })
  return rows.map((r) => r.followingId)
}

export async function isFollowing(follower: string, following: string): Promise<boolean> {
  return (await prisma.vipFollow.count({ where: { followerId: follower, followingId: following } })) > 0
}

/** Can this user open the clubhouse community right now (member, not suspended)? */
export async function isCommunityMember(userId: string): Promise<boolean> {
  return (await prisma.user.count({ where: { AND: [memberWhere, { id: userId }] } })) > 0
}

type Fail = { ok: false; error: string; status: number }
type Ok = { ok: true }

export async function followMember(viewer: VipViewer, targetId: string): Promise<Ok | Fail> {
  if (targetId === viewer.userId) return { ok: false, error: 'You can’t follow yourself.', status: 400 }
  if (!(await isCommunityMember(targetId))) return { ok: false, error: 'Member not found.', status: 404 }
  if (await isBlockedBetween(viewer.userId, targetId)) return { ok: false, error: 'Member not found.', status: 404 }
  let created = false
  try {
    await prisma.vipFollow.create({ data: { followerId: viewer.userId, followingId: targetId } })
    created = true
  } catch {
    // already following (unique key) — following twice is a no-op
  }
  if (created) await notifyFollow({ actorId: viewer.userId, userId: targetId })
  return { ok: true }
}

export async function unfollowMember(viewer: VipViewer, targetId: string): Promise<Ok> {
  await prisma.vipFollow.deleteMany({ where: { followerId: viewer.userId, followingId: targetId } })
  return { ok: true }
}

export async function blockMember(viewer: VipViewer, targetId: string): Promise<Ok | Fail> {
  if (targetId === viewer.userId) return { ok: false, error: 'You can’t block yourself.', status: 400 }
  const exists = await prisma.user.count({ where: { id: targetId } })
  if (!exists) return { ok: false, error: 'Member not found.', status: 404 }
  await prisma.$transaction([
    prisma.vipBlock.upsert({
      where: { blockerId_blockedId: { blockerId: viewer.userId, blockedId: targetId } },
      update: {},
      create: { blockerId: viewer.userId, blockedId: targetId },
    }),
    prisma.vipFollow.deleteMany({
      where: {
        OR: [
          { followerId: viewer.userId, followingId: targetId },
          { followerId: targetId, followingId: viewer.userId },
        ],
      },
    }),
  ])
  return { ok: true }
}

export async function unblockMember(viewer: VipViewer, targetId: string): Promise<Ok> {
  await prisma.vipBlock.deleteMany({ where: { blockerId: viewer.userId, blockedId: targetId } })
  return { ok: true }
}

export async function socialCounts(userId: string): Promise<{ posts: number; followers: number; following: number }> {
  const [posts, followers, following] = await Promise.all([
    prisma.vipPost.count({ where: { authorId: userId, hiddenAt: null } }),
    prisma.vipFollow.count({ where: { followingId: userId, follower: memberWhere } }),
    prisma.vipFollow.count({ where: { followerId: userId, following: memberWhere } }),
  ])
  return { posts, followers, following }
}

/**
 * Whether the viewer sees the full profile. Self and the team always do;
 * MEMBERS profiles open to every member; FOLLOWERS profiles to followers.
 */
export async function canViewFullProfile(
  viewer: VipViewer,
  targetId: string,
  visibility: ProfileVisibility,
): Promise<boolean> {
  if (viewer.userId === targetId || viewer.isAdmin) return true
  if (visibility === 'MEMBERS') return true
  return isFollowing(viewer.userId, targetId)
}

// ─── Member cards (lists) ───────────────────────────────────────────────────

export interface FollowListItem extends MemberCard {
  followedByMe: boolean
}

async function withFollowState(viewerId: string, cards: MemberCard[]): Promise<FollowListItem[]> {
  if (!cards.length) return []
  const mine = await prisma.vipFollow.findMany({
    where: { followerId: viewerId, followingId: { in: cards.map((c) => c.id) } },
    select: { followingId: true },
  })
  const set = new Set(mine.map((m) => m.followingId))
  return cards.map((c) => ({ ...c, followedByMe: set.has(c.id) }))
}

/** Followers of / people followed by `userId`, minus anyone blocked with the viewer. */
export async function listFollows(
  viewer: VipViewer,
  userId: string,
  which: 'followers' | 'following',
): Promise<FollowListItem[]> {
  const hidden = await blockedIdSet(viewer.userId)
  const rows = await prisma.vipFollow.findMany({
    where: which === 'followers' ? { followingId: userId } : { followerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: { followerId: true, followingId: true },
  })
  const ids = rows.map((r) => (which === 'followers' ? r.followerId : r.followingId)).filter((id) => !hidden.has(id))
  if (!ids.length) return []
  const users = await prisma.user.findMany({ where: { AND: [memberWhere, { id: { in: ids } }] }, select: cardSelect })
  const byId = new Map(users.map((u) => [u.id, toCard(u)]))
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as MemberCard[]
  return withFollowState(viewer.userId, ordered)
}

export interface Suggestion extends MemberCard {
  reason: string
}

/**
 * Members to follow: people followed by the people you follow, people who
 * share your interests, members active this fortnight, then the newest
 * members. Never yourself, anyone you follow, or anyone blocked either way.
 */
export async function suggestedMembers(viewer: VipViewer, limit = 6): Promise<Suggestion[]> {
  const [following, hidden, myTags] = await Promise.all([
    followingIds(viewer.userId),
    blockedIdSet(viewer.userId),
    prisma.vipInterest.findMany({ where: { userId: viewer.userId }, select: { tag: true } }),
  ])
  const exclude = new Set<string>([viewer.userId, ...following, ...hidden])
  const notIn = [...exclude]
  const since = new Date(Date.now() - 14 * 24 * 3600e3)

  const [mutual, shared, active] = await Promise.all([
    following.length
      ? prisma.vipFollow.groupBy({
          by: ['followingId'],
          where: { followerId: { in: following }, followingId: { notIn } },
          _count: { _all: true },
          orderBy: { _count: { followingId: 'desc' } },
          take: 50,
        })
      : Promise.resolve([]),
    myTags.length
      ? prisma.vipInterest.groupBy({
          by: ['userId'],
          where: { tag: { in: myTags.map((t) => t.tag) }, userId: { notIn } },
          _count: { _all: true },
          orderBy: { _count: { userId: 'desc' } },
          take: 50,
        })
      : Promise.resolve([]),
    prisma.vipPost.groupBy({
      by: ['authorId'],
      where: { createdAt: { gte: since }, hiddenAt: null, authorId: { notIn } },
      _count: { _all: true },
      orderBy: { _count: { authorId: 'desc' } },
      take: 50,
    }),
  ])

  const score = new Map<string, { s: number; reason: string }>()
  const bump = (id: string, s: number, reason: string) => {
    const cur = score.get(id)
    if (!cur) score.set(id, { s, reason })
    else score.set(id, { s: cur.s + s, reason: cur.s >= s ? cur.reason : reason })
  }
  for (const m of mutual) bump(m.followingId, 3 * m._count._all, 'Followed by people you follow')
  for (const m of shared) bump(m.userId, 2 * m._count._all, 'Shares your interests')
  for (const m of active) bump(m.authorId, Math.min(3, m._count._all), 'Active this fortnight')

  const ranked = [...score.entries()].sort((a, b) => b[1].s - a[1].s).map(([id]) => id)
  const users = ranked.length
    ? await prisma.user.findMany({ where: { AND: [memberWhere, { id: { in: ranked.slice(0, 60) } }] }, select: cardSelect })
    : []
  const byId = new Map(users.map((u) => [u.id, u]))
  const out: Suggestion[] = []
  for (const id of ranked) {
    const u = byId.get(id)
    if (u) out.push({ ...toCard(u), reason: score.get(id)!.reason })
    if (out.length >= limit) return out
  }
  // Fill with the newest members.
  const taken = new Set([...notIn, ...out.map((o) => o.id)])
  const fresh = await prisma.user.findMany({
    where: { AND: [memberWhere, { id: { notIn: [...taken] } }] },
    select: cardSelect,
    orderBy: { createdAt: 'desc' },
    take: limit - out.length,
  })
  for (const u of fresh) out.push({ ...toCard(u), reason: 'New to the clubhouse' })
  return out
}

// ─── Profile read model ─────────────────────────────────────────────────────

export interface BadgeView {
  badgeKey: string
  label: string
  awardedAt: string
}

export interface ProfileView {
  card: MemberCard
  coverUrl: string | null
  location: string | null
  interests: string[]
  badges: BadgeView[]
  visibility: ProfileVisibility
  /** The viewer sees the whole profile (bio, stats, posts, activity, lists). */
  full: boolean
  isSelf: boolean
  stats: { posts: number; followers: number; following: number }
  followedByMe: boolean
  followsMe: boolean
  /** The viewer blocked this member (the page offers Unblock and nothing else). */
  blockedByMe: boolean
}

/**
 * A member's profile as the viewer may see it, or null when it must look
 * like it doesn't exist: not a community member, or they blocked the viewer.
 */
export async function loadProfile(viewer: VipViewer, idOrHandle: string): Promise<ProfileView | null> {
  const card = await getMemberCard(idOrHandle)
  if (!card) return null
  const isSelf = card.id === viewer.userId
  const [blockedMe, blockedByMe] = isSelf
    ? [false, false]
    : await Promise.all([hasBlocked(card.id, viewer.userId), hasBlocked(viewer.userId, card.id)])
  if (blockedMe) return null

  const [profile, interests, badges, stats, followedByMe, followsMe] = await Promise.all([
    prisma.vipProfile.findUnique({
      where: { userId: card.id },
      select: { coverUrl: true, location: true, profileVisibility: true },
    }),
    prisma.vipInterest.findMany({ where: { userId: card.id }, orderBy: { tag: 'asc' }, select: { tag: true } }),
    prisma.vipUserBadge.findMany({
      where: { userId: card.id },
      orderBy: { awardedAt: 'desc' },
      select: { badgeKey: true, label: true, awardedAt: true },
    }),
    socialCounts(card.id),
    isSelf ? Promise.resolve(false) : isFollowing(viewer.userId, card.id),
    isSelf ? Promise.resolve(false) : isFollowing(card.id, viewer.userId),
  ])
  const visibility = readVisibility(profile?.profileVisibility)
  const full = !blockedByMe && (isSelf || viewer.isAdmin || visibility === 'MEMBERS' || followedByMe)
  return {
    card: full ? card : { ...card, bio: null },
    coverUrl: full ? (profile?.coverUrl ?? null) : null,
    location: full ? (profile?.location ?? null) : null,
    interests: full ? interests.map((i) => i.tag) : [],
    badges: full ? badges.map((b) => ({ ...b, awardedAt: b.awardedAt.toISOString() })) : [],
    visibility,
    full,
    isSelf,
    stats,
    followedByMe,
    followsMe,
    blockedByMe,
  }
}

export interface ActivityItem {
  kind: 'post' | 'comment' | 'follow'
  at: string
  postId?: string
  text?: string
  target?: { id: string; displayName: string }
}

/** A member's recent activity: posts, comments on visible posts, follows. */
export async function memberActivity(viewer: VipViewer, userId: string, take = 30): Promise<ActivityItem[]> {
  const hidden = await blockedIdSet(viewer.userId)
  const notHidden = hidden.size ? { notIn: [...hidden] } : undefined
  const [posts, comments, follows] = await Promise.all([
    prisma.vipPost.findMany({
      where: { authorId: userId, hiddenAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, body: true, createdAt: true },
    }),
    prisma.vipComment.findMany({
      where: {
        authorId: userId,
        hiddenAt: null,
        post: { hiddenAt: null, ...(notHidden ? { authorId: notHidden } : {}) },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: { body: true, createdAt: true, postId: true },
    }),
    prisma.vipFollow.findMany({
      where: { followerId: userId, following: memberWhere, ...(notHidden ? { followingId: notHidden } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        createdAt: true,
        following: { select: { id: true, name: true, username: true, vipProfile: { select: { displayName: true } } } },
      },
    }),
  ])
  const clip = (s: string) => {
    const t = s.trim().replace(/\s+/g, ' ')
    return t.length > 140 ? `${t.slice(0, 140)}…` : t
  }
  const items: ActivityItem[] = [
    ...posts.map((p) => ({ kind: 'post' as const, at: p.createdAt.toISOString(), postId: p.id, text: clip(p.body) })),
    ...comments.map((c) => ({ kind: 'comment' as const, at: c.createdAt.toISOString(), postId: c.postId, text: clip(c.body) })),
    ...follows.map((f) => ({
      kind: 'follow' as const,
      at: f.createdAt.toISOString(),
      target: {
        id: f.following.id,
        displayName: f.following.vipProfile?.displayName || f.following.name || f.following.username || 'Member',
      },
    })),
  ]
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, take)
}

/** Members the viewer has blocked (for the profile settings list). */
export async function listMyBlocks(
  viewer: VipViewer,
): Promise<{ id: string; displayName: string; avatarUrl: string | null }[]> {
  const rows = await prisma.vipBlock.findMany({
    where: { blockerId: viewer.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      blocked: {
        select: { id: true, name: true, username: true, vipProfile: { select: { displayName: true, avatarUrl: true } } },
      },
    },
  })
  return rows.map((r) => ({
    id: r.blocked.id,
    displayName: r.blocked.vipProfile?.displayName || r.blocked.name || r.blocked.username || 'Member',
    avatarUrl: r.blocked.vipProfile?.avatarUrl ?? null,
  }))
}
