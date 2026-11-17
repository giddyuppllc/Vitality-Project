import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listCourses } from '@/lib/vip/classroom'
import { listTracks } from '@/lib/vip/tracks'
import { suggestedMembers } from '@/lib/vip/social'
import { OnboardingFlow } from '@/components/vip/onboarding-flow'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Welcome' }

/** First-run flow. The dashboard links here until it is finished or skipped; it can be re-run from Settings. */
export default async function WelcomePage() {
  const viewer = await requireVipPage('member')
  const [profile, onboarding, courses, suggestions, fitness] = await Promise.all([
    prisma.vipProfile.findUnique({ where: { userId: viewer.userId }, select: { displayName: true, bio: true, emailDigest: true, emailEvents: true, emailRewards: true } }),
    prisma.vipOnboarding.findUnique({ where: { userId: viewer.userId } }),
    listCourses(viewer.userId, viewer.accessTier, { isAdmin: viewer.isAdmin }),
    viewer.suspended ? Promise.resolve([]) : suggestedMembers(viewer, 6),
    prisma.vipFitnessProfile.findUnique({ where: { userId: viewer.userId }, select: { units: true } }),
  ])
  const tracks = await listTracks(courses)
  const name = profile?.displayName || viewer.name || viewer.username || ''

  return (
    <div className="py-2 sm:py-6">
      <OnboardingFlow
        firstName={(name || 'there').split(/\s+/)[0]}
        suspended={viewer.suspended}
        extra={{
          suggestions: suggestions.map((m) => ({ id: m.id, displayName: m.displayName, avatarUrl: m.avatarUrl, reason: m.reason })),
          units: fitness?.units ?? 'IMPERIAL',
        }}
        tracks={tracks.map((t) => ({ id: t.id, title: t.title, summary: t.summary, category: t.category, courseCount: t.courses.length }))}
        initial={{
          displayName: name,
          bio: profile?.bio ?? '',
          interests: onboarding?.interests ?? [],
          goals: onboarding?.goals ?? [],
          trackId: onboarding?.trackId ?? null,
          emailDigest: profile?.emailDigest ?? true,
          emailEvents: profile?.emailEvents ?? true,
          emailRewards: profile?.emailRewards ?? true,
        }}
      />
    </div>
  )
}
