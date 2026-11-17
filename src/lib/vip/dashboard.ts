import { prisma } from '@/lib/prisma'
import type { VipViewer } from './access'
import { continueLearning, listCourses, listUpcomingEvents } from './classroom'
import { toAuthor } from './feed'
import { pointsBalance } from './points'

/**
 * Everything the member home (/dashboard) shows, fetched in parallel.
 * Sections owned by other clubhouse builders (today's workout, check-in,
 * challenges, rewards catalog, people you follow) are links to their routes
 * from the page itself, not queries here.
 */
export async function loadDashboard(viewer: VipViewer, now = new Date()) {
  const [membership, points, learning, courses, events, posts, onboarding, certificates] = await Promise.all([
    prisma.membership.findUnique({ where: { userId: viewer.userId }, select: { renewsAt: true, status: true, tier: true } }),
    pointsBalance(viewer.userId),
    continueLearning(viewer.userId, viewer.accessTier, { isAdmin: viewer.isAdmin, take: 3 }),
    listCourses(viewer.userId, viewer.accessTier, { isAdmin: viewer.isAdmin }),
    listUpcomingEvents(viewer.userId, viewer.accessTier, now),
    viewer.suspended
      ? Promise.resolve([])
      : prisma.vipPost.findMany({
          where: { hiddenAt: null, OR: [{ spaceId: null }, { space: { archived: false } }] },
          orderBy: { createdAt: 'desc' },
          take: 4,
          select: {
            id: true,
            body: true,
            createdAt: true,
            space: { select: { name: true, slug: true } },
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
            _count: { select: { comments: { where: { hiddenAt: null } }, reactions: true } },
          },
        }),
    prisma.vipOnboarding.findUnique({ where: { userId: viewer.userId }, select: { completedAt: true, skippedAt: true, trackId: true } }),
    prisma.vipCertificate.count({ where: { userId: viewer.userId } }),
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
    posts: posts.map((p) => ({
      id: p.id,
      body: p.body,
      createdAt: p.createdAt.toISOString(),
      space: p.space,
      author: toAuthor(p.author),
      comments: p._count.comments,
      likes: p._count.reactions,
    })),
    needsOnboarding: !onboarding || (!onboarding.completedAt && !onboarding.skippedAt),
    certificates,
    coursesInProgress: courses.filter((c) => c.allowed && c.completedCount > 0 && !c.certificateCode).length,
  }
}
