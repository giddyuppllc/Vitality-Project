import { prisma } from '@/lib/prisma'
import { VIP_COPY } from './copy'

export interface OnboardingStep {
  key: string
  title: string
  href: string
  done: boolean
}

/** The "Start here" checklist, computed from what the member has already done. */
export async function onboardingSteps(userId: string): Promise<OnboardingStep[]> {
  const [profile, intro, progress, rsvp] = await Promise.all([
    prisma.vipProfile.findUnique({ where: { userId }, select: { avatarUrl: true, bio: true } }),
    prisma.vipPost.count({ where: { authorId: userId, space: { slug: 'introductions' } } }),
    prisma.vipLessonProgress.count({ where: { userId } }),
    prisma.vipEventRsvp.count({ where: { userId } }),
  ])
  const done: Record<string, boolean> = {
    profile: !!(profile?.avatarUrl || profile?.bio),
    intro: intro > 0,
    course: progress > 0,
    event: rsvp > 0,
  }
  return VIP_COPY.onboarding.steps.map((s) => ({ ...s, done: !!done[s.key] }))
}
