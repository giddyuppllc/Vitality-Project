import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { VipViewer } from './access'
import { continueLearning, listCourses, listUpcomingEvents } from './classroom'
import { toAuthor } from './feed'
import { pointsBalance } from './points'
import { blockedIdSet } from './blocks'
import { listCatalog } from './catalog'
import { getFitnessPrefs, todayIn } from './fitness/profile'
import { getTodaysWorkout } from './fitness/programs'
import { findOpenWorkout } from './fitness/workouts'
import { streakInfo } from './fitness/health'
import { listChallenges } from './fitness/challenges'

/** Today's workout, today's check-in and the member's active challenges (fitness data). */
async function loadFitness(viewer: VipViewer, now: Date) {
  const prefs = await getFitnessPrefs(viewer.userId)
  const today = todayIn(prefs.timeZone, now)
  const [plan, open, streak, challenges] = await Promise.all([
    getTodaysWorkout(viewer.userId, viewer.accessTier),
    findOpenWorkout(viewer.userId),
    streakInfo(viewer.userId, today),
    listChallenges(viewer.userId, viewer.accessTier, today),
  ])
  const active = challenges.filter((c) => c.status === 'active' && c.allowed)
  return {
    workout: plan
      ? {
          programTitle: plan.program.title,
          programSlug: plan.program.slug,
          allowed: plan.allowed,
          dayTitle: plan.day?.title ?? null,
          rest: !!plan.day && plan.day.workouts.length === 0 && plan.allowed,
          position: plan.position,
          finished: !plan.day,
        }
      : null,
    openWorkout: open ? { id: open.id, title: open.title } : null,
    checkedInToday: streak.checkedInToday,
    streak: streak.current,
    // Joined first, then ones the member could join; three at most.
    challenges: [...active.filter((c) => c.joined), ...active.filter((c) => !c.joined)].slice(0, 3).map((c) => ({
      slug: c.slug,
      title: c.title,
      joined: c.joined,
      completed: c.completed,
      score: c.score,
      target: c.target,
      metric: c.metric,
      endDate: c.endDate,
      participants: c.participants,
    })),
  }
}

/**
 * Posts from people the member follows (blocked either way excluded); when
 * they follow nobody — or nobody they follow has posted — the latest posts.
 */
async function loadCommunity(viewer: VipViewer) {
  const [blocked, follows] = await Promise.all([
    blockedIdSet(viewer.userId),
    prisma.vipFollow.findMany({ where: { followerId: viewer.userId }, select: { followingId: true } }),
  ])
  const base: Prisma.VipPostWhereInput = { hiddenAt: null, OR: [{ spaceId: null }, { space: { archived: false } }] }
  const select = {
    id: true,
    body: true,
    createdAt: true,
    space: { select: { name: true, slug: true } },
    _count: { select: { comments: { where: { hiddenAt: null } }, reactions: true, images: true } },
    author: {
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        vipProfile: { select: { displayName: true, avatarUrl: true } },
        membership: { select: { tier: true, status: true } },
      },
    },
  } satisfies Prisma.VipPostSelect
  const followed = follows.map((f) => f.followingId).filter((id) => !blocked.has(id))
  if (followed.length) {
    const rows = await prisma.vipPost.findMany({ where: { ...base, authorId: { in: followed } }, orderBy: { createdAt: 'desc' }, take: 4, select })
    if (rows.length) return { source: 'following' as const, rows }
  }
  const rows = await prisma.vipPost.findMany({
    where: { ...base, ...(blocked.size ? { authorId: { notIn: [...blocked] } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 4,
    select,
  })
  return { source: 'latest' as const, rows }
}

/** The member's balance against the live rewards catalog: what they can redeem now, then the closest. */
async function loadRewards(viewer: VipViewer) {
  const items = await listCatalog({ userId: viewer.userId, accessTier: viewer.accessTier })
  const usable = items.filter((i) => i.tierOk && i.inStock && !i.limitReached && !i.alreadyUnlocked)
  const sorted = [...usable.filter((i) => i.canAfford).sort((a, b) => b.pointsCost - a.pointsCost), ...usable.filter((i) => !i.canAfford).sort((a, b) => a.pointsCost - b.pointsCost)]
  return sorted.slice(0, 3).map((i) => ({ id: i.id, title: i.title, kind: i.kind, pointsCost: i.pointsCost, canAfford: i.canAfford }))
}

/**
 * Everything the member home (/dashboard) shows, in ONE parallel load:
 * membership, points + rewards catalog, Academy progress, sessions, today's
 * workout + check-in + active challenges (fitness), and the community card
 * (people the member follows, else the latest posts).
 */
export async function loadDashboard(viewer: VipViewer, now = new Date()) {
  const [membership, points, learning, courses, events, community, onboarding, certificates, fitness, rewards] = await Promise.all([
    prisma.membership.findUnique({ where: { userId: viewer.userId }, select: { renewsAt: true, status: true, tier: true } }),
    pointsBalance(viewer.userId),
    continueLearning(viewer.userId, viewer.accessTier, { isAdmin: viewer.isAdmin, take: 3 }),
    listCourses(viewer.userId, viewer.accessTier, { isAdmin: viewer.isAdmin }),
    listUpcomingEvents(viewer.userId, viewer.accessTier, now),
    viewer.suspended ? Promise.resolve({ source: 'latest' as const, rows: [] }) : loadCommunity(viewer),
    prisma.vipOnboarding.findUnique({ where: { userId: viewer.userId }, select: { completedAt: true, skippedAt: true, trackId: true } }),
    prisma.vipCertificate.count({ where: { userId: viewer.userId } }),
    loadFitness(viewer, now),
    loadRewards(viewer),
  ])

  // A first course to suggest when there is nothing to resume: the chosen
  // learning path's first open course, else the first open course.
  const open = courses.filter((c) => c.allowed && !c.certificateCode && c.lessonCount > 0)
  const suggested = learning.length
    ? null
    : (onboarding?.trackId ? open.find((c) => c.track?.id === onboarding.trackId) : null) ?? open[0] ?? null
  const unlockable = courses.filter((c) => !c.allowed && c.pointsPrice).slice(0, 3)

  return {
    membership: membership && membership.status === 'ACTIVE' ? { renewsAt: membership.renewsAt?.toISOString() ?? null } : null,
    points,
    learning,
    suggested,
    unlockable,
    events: events.filter((e) => !e.ended).slice(0, 3),
    postsSource: community.source,
    posts: community.rows.map((p) => ({
      id: p.id,
      body: p.body,
      createdAt: p.createdAt.toISOString(),
      space: p.space,
      author: toAuthor(p.author),
      comments: p._count.comments,
      likes: p._count.reactions,
      photos: p._count.images,
    })),
    fitness,
    rewards,
    needsOnboarding: !onboarding || (!onboarding.completedAt && !onboarding.skippedAt),
    certificates,
    coursesInProgress: courses.filter((c) => c.allowed && c.completedCount > 0 && !c.certificateCode).length,
  }
}
