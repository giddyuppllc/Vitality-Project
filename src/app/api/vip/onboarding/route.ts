import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { GOAL_KEYS, INTEREST_KEYS, MAX_GOALS } from '@/lib/vip/onboarding-options'

export const dynamic = 'force-dynamic'

/** POST /api/vip/onboarding — hide the "Start here" checklist for this member. */
export async function POST() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const now = new Date()
  await prisma.vipProfile.upsert({
    where: { userId: gate.viewer.userId },
    update: { onboardedAt: now },
    create: { userId: gate.viewer.userId, onboardedAt: now },
  })
  return vipJson({ ok: true })
}

const putSchema = z.union([
  z.object({ skip: z.literal(true) }),
  z.object({
    displayName: z.string().trim().max(60).nullish(),
    bio: z.string().trim().max(600).nullish(),
    interests: z.array(z.enum(INTEREST_KEYS)).max(INTEREST_KEYS.length),
    goals: z.array(z.enum(GOAL_KEYS)).max(MAX_GOALS),
    trackId: z.string().max(64).nullish(),
    emailDigest: z.boolean(),
    emailEvents: z.boolean(),
    emailRewards: z.boolean(),
  }),
])

/**
 * PUT /api/vip/onboarding — finish (or skip) the first-run flow at /welcome.
 * Saves profile basics (not for community-suspended members), email
 * preferences, interests, goals and the chosen learning path in one go.
 */
export async function PUT(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const v = gate.viewer
  const parsed = putSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid answers' }, { status: 400 })
  const d = parsed.data
  const now = new Date()

  if ('skip' in d) {
    await prisma.vipOnboarding.upsert({
      where: { userId: v.userId },
      update: { skippedAt: now },
      create: { userId: v.userId, interests: [], goals: [], skippedAt: now },
    })
    return vipJson({ ok: true, skipped: true })
  }

  let trackSlug: string | null = null
  if (d.trackId) {
    const t = await prisma.vipTrack.findUnique({ where: { id: d.trackId }, select: { slug: true, published: true } })
    if (!t || !t.published) return vipJson({ error: 'That learning path is not available' }, { status: 400 })
    trackSlug = t.slug
  }

  const profile = {
    emailDigest: d.emailDigest,
    emailEvents: d.emailEvents,
    emailRewards: d.emailRewards,
    // Display name and bio are community-facing: suspended members can't change them.
    ...(v.suspended ? {} : { ...(d.displayName !== undefined ? { displayName: d.displayName || null } : {}), ...(d.bio !== undefined ? { bio: d.bio || null } : {}) }),
  }
  const answers = { interests: [...new Set(d.interests)], goals: [...new Set(d.goals)], trackId: d.trackId || null, completedAt: now }
  await prisma.$transaction([
    prisma.vipProfile.upsert({ where: { userId: v.userId }, update: profile, create: { userId: v.userId, ...profile } }),
    prisma.vipOnboarding.upsert({ where: { userId: v.userId }, update: answers, create: { userId: v.userId, ...answers } }),
  ])
  return vipJson({ ok: true, next: trackSlug ? `/classroom/paths/${trackSlug}` : '/dashboard' })
}
