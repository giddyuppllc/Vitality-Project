import type { MembershipTier, VipChallenge, VipChallengeMetric } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from '@/lib/vip/access'
import { awardPoints } from '@/lib/vip/points'
import { localDate, longestRun } from './dates'
import { awardBadge } from './badges'
import { getFitnessPrefs } from './profile'

/**
 * Challenges: a coach sets a date range, a metric and a target. Members join;
 * progress is computed from their own logged activity inside the range (on
 * their local calendar); reaching the target completes the challenge once —
 * badge + the challenge's points, both exactly-once.
 *
 * Leaderboards respect "Hide me from leaderboards": a hidden member is left
 * out of everyone else's view (they still see their own standing).
 * Community-suspended members are left out of other members' boards too.
 */

export const METRIC_LABEL: Record<VipChallengeMetric, { name: string; unit: (n: number) => string }> = {
  WORKOUTS: { name: 'Workouts completed', unit: (n) => (n === 1 ? 'workout' : 'workouts') },
  STEPS: { name: 'Steps', unit: (n) => (n === 1 ? 'step' : 'steps') },
  CHECKIN_STREAK: { name: 'Check-in streak', unit: (n) => (n === 1 ? 'day' : 'days') },
  CUSTOM_POINTS: { name: 'Coach-scored points', unit: (n) => (n === 1 ? 'point' : 'points') },
}

export type ChallengeStatus = 'upcoming' | 'active' | 'ended'

export function challengeStatus(c: Pick<VipChallenge, 'startDate' | 'endDate'>, today: string): ChallengeStatus {
  if (today < c.startDate) return 'upcoming'
  if (today > c.endDate) return 'ended'
  return 'active'
}

/** Progress for each member in `userIds`, computed from activity inside the range. */
export async function challengeScores(c: VipChallenge, userIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>(userIds.map((u) => [u, 0]))
  if (userIds.length === 0) return out
  const range = { gte: c.startDate, lte: c.endDate }
  switch (c.metric) {
    case 'WORKOUTS': {
      const rows = await prisma.vipWorkoutLog.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, finishedAt: { not: null }, localDate: range },
        _count: { _all: true },
      })
      for (const r of rows) out.set(r.userId, r._count._all)
      break
    }
    case 'STEPS': {
      const rows = await prisma.vipCheckin.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, date: range },
        _sum: { steps: true },
      })
      for (const r of rows) out.set(r.userId, r._sum.steps ?? 0)
      break
    }
    case 'CHECKIN_STREAK': {
      const rows = await prisma.vipCheckin.findMany({ where: { userId: { in: userIds }, date: range }, select: { userId: true, date: true } })
      const by = new Map<string, string[]>()
      for (const r of rows) by.set(r.userId, [...(by.get(r.userId) ?? []), r.date])
      for (const [u, dates] of by) out.set(u, longestRun(dates, c.startDate, c.endDate))
      break
    }
    case 'CUSTOM_POINTS': {
      const rows = await prisma.vipChallengeParticipant.findMany({
        where: { challengeId: c.id, userId: { in: userIds } },
        select: { userId: true, customScore: true },
      })
      for (const r of rows) out.set(r.userId, r.customScore)
      break
    }
  }
  return out
}

/**
 * Complete the member's challenge if they've reached the target. Exactly
 * once: the conditional update claims it; the badge and points are keyed too.
 */
async function completeIfReached(c: VipChallenge, userId: string, score: number, now: Date): Promise<{ title: string; points: number } | null> {
  if (score < c.target) return null
  const { count } = await prisma.vipChallengeParticipant.updateMany({
    where: { challengeId: c.id, userId, completedAt: null },
    data: { completedAt: now },
  })
  if (count === 0) return null
  await awardBadge(userId, `challenge:${c.slug}`, c.badgeLabel?.trim() || c.title)
  let points = 0
  if (c.pointsReward > 0) {
    const r = await awardPoints({
      userId,
      points: c.pointsReward,
      type: 'EARN_ENGAGEMENT',
      description: `Challenge completed: ${c.title}`.slice(0, 190),
      idempotencyKey: `challenge:${userId}:${c.id}`,
    })
    if (!r.duplicate) points = c.pointsReward
  }
  return { title: c.title, points }
}

/**
 * Re-check every unfinished challenge the member has joined (called after a
 * workout, a check-in, a join, and when a coach enters a score). Returns the
 * challenges completed just now.
 */
export async function evaluateChallengesFor(userId: string, now = new Date()) {
  const entries = await prisma.vipChallengeParticipant.findMany({
    where: { userId, completedAt: null, challenge: { published: true } },
    include: { challenge: true },
  })
  if (entries.length === 0) return []
  const { timeZone } = await getFitnessPrefs(userId)
  const today = localDate(now, timeZone)
  const done: { title: string; points: number }[] = []
  for (const e of entries) {
    if (today < e.challenge.startDate) continue
    const score = (await challengeScores(e.challenge, [userId])).get(userId) ?? 0
    const r = await completeIfReached(e.challenge, userId, score, now)
    if (r) done.push(r)
  }
  return done
}

/** Re-check every participant of one challenge (after a coach edits the target or scores). */
export async function evaluateChallenge(challengeId: string, now = new Date()) {
  const c = await prisma.vipChallenge.findUnique({ where: { id: challengeId } })
  if (!c || !c.published) return 0
  const open = await prisma.vipChallengeParticipant.findMany({ where: { challengeId, completedAt: null }, select: { userId: true } })
  const scores = await challengeScores(c, open.map((p) => p.userId))
  let n = 0
  for (const [u, s] of scores) if (await completeIfReached(c, u, s, now)) n += 1
  return n
}

export async function listChallenges(userId: string, accessTier: MembershipTier, today: string) {
  const rows = await prisma.vipChallenge.findMany({
    where: { published: true },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    include: { _count: { select: { participants: true } }, participants: { where: { userId }, select: { completedAt: true } } },
  })
  const mine = rows.filter((c) => c.participants.length > 0)
  const scores = new Map<string, number>()
  for (const c of mine) scores.set(c.id, (await challengeScores(c, [userId])).get(userId) ?? 0)
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    coverImage: c.coverImage,
    metric: c.metric,
    target: c.target,
    startDate: c.startDate,
    endDate: c.endDate,
    minTier: c.minTier,
    pointsReward: c.pointsReward,
    status: challengeStatus(c, today),
    allowed: tierAllows(accessTier, c.minTier),
    participants: c._count.participants,
    joined: c.participants.length > 0,
    completed: !!c.participants[0]?.completedAt,
    score: scores.get(c.id) ?? null,
  }))
}

export async function getChallenge(slug: string) {
  const c = await prisma.vipChallenge.findUnique({ where: { slug } })
  return c && c.published ? c : null
}

export class ChallengeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function joinChallenge(userId: string, accessTier: MembershipTier, challengeId: string, now = new Date()) {
  const c = await prisma.vipChallenge.findUnique({ where: { id: challengeId } })
  if (!c || !c.published) throw new ChallengeError('Challenge not found', 404)
  if (!tierAllows(accessTier, c.minTier)) throw new ChallengeError('This challenge needs a higher membership tier', 403)
  const { timeZone } = await getFitnessPrefs(userId)
  if (challengeStatus(c, localDate(now, timeZone)) === 'ended') throw new ChallengeError('This challenge has ended', 409)
  await prisma.vipChallengeParticipant.upsert({
    where: { challengeId_userId: { challengeId, userId } },
    create: { challengeId, userId },
    update: {},
  })
  return evaluateChallengesFor(userId, now)
}

export async function leaveChallenge(userId: string, challengeId: string) {
  const p = await prisma.vipChallengeParticipant.findUnique({ where: { challengeId_userId: { challengeId, userId } } })
  if (!p) return false
  if (p.completedAt) throw new ChallengeError('Completed challenges stay on your record', 409)
  await prisma.vipChallengeParticipant.delete({ where: { id: p.id } })
  return true
}

export interface LeaderboardRow {
  userId: string
  name: string
  avatarUrl: string | null
  score: number
  completed: boolean
  hidden: boolean
  rank: number
  isViewer: boolean
}

/**
 * Ranked participants. For a member: hidden and community-suspended members
 * are left out, except the viewer themself. For admins (`all: true`):
 * everyone, flagged.
 */
export async function leaderboard(challengeId: string, opts: { viewerId?: string; all?: boolean; take?: number } = {}): Promise<LeaderboardRow[]> {
  const c = await prisma.vipChallenge.findUnique({ where: { id: challengeId } })
  if (!c) return []
  const parts = await prisma.vipChallengeParticipant.findMany({
    where: { challengeId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          vipProfile: { select: { displayName: true, avatarUrl: true, suspendedAt: true } },
          vipFitnessProfile: { select: { hideFromLeaderboards: true } },
        },
      },
    },
  })
  const scores = await challengeScores(c, parts.map((p) => p.userId))
  const rows = parts
    .map((p) => {
      const hidden = !!p.user.vipFitnessProfile?.hideFromLeaderboards
      const suspended = !!p.user.vipProfile?.suspendedAt && p.user.role !== 'ADMIN'
      return {
        userId: p.userId,
        name: p.user.vipProfile?.displayName || p.user.name || p.user.username || 'Member',
        avatarUrl: p.user.vipProfile?.avatarUrl ?? null,
        score: scores.get(p.userId) ?? 0,
        completed: !!p.completedAt,
        completedAt: p.completedAt,
        hidden,
        suspended,
        isViewer: p.userId === opts.viewerId,
      }
    })
    .filter((r) => opts.all || r.isViewer || (!r.hidden && !r.suspended))
    .sort((a, b) => b.score - a.score || (a.completedAt?.getTime() ?? Infinity) - (b.completedAt?.getTime() ?? Infinity) || a.name.localeCompare(b.name))
  let rank = 0
  let prev: number | null = null
  return rows.slice(0, opts.take ?? 500).map((r, i) => {
    if (prev === null || r.score !== prev) rank = i + 1
    prev = r.score
    return { userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, score: r.score, completed: r.completed, hidden: r.hidden, rank, isViewer: r.isViewer }
  })
}
