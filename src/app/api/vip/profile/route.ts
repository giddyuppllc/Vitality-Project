import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'
import { isVipMediaUrl } from '@/lib/vip/media'
import { DM_POLICIES, PROFILE_VISIBILITY, readDmPolicy, readVisibility } from '@/lib/vip/social'
import { normaliseTag } from '@/lib/vip/text'

export const dynamic = 'force-dynamic'

const MAX_INTERESTS = 10

/** GET /api/vip/profile — the viewer's own clubhouse profile. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const [profile, interests] = await Promise.all([
    prisma.vipProfile.findUnique({
      where: { userId: gate.viewer.userId },
      select: {
        displayName: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        location: true,
        profileVisibility: true,
        dmPolicy: true,
      },
    }),
    prisma.vipInterest.findMany({ where: { userId: gate.viewer.userId }, orderBy: { tag: 'asc' }, select: { tag: true } }),
  ])
  return vipJson({
    profile: {
      displayName: profile?.displayName ?? null,
      bio: profile?.bio ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      coverUrl: profile?.coverUrl ?? null,
      location: profile?.location ?? null,
      interests: interests.map((i) => i.tag),
      profileVisibility: readVisibility(profile?.profileVisibility),
      dmPolicy: readDmPolicy(profile?.dmPolicy),
    },
  })
}

const schema = z.object({
  displayName: z.string().trim().max(60).nullish(),
  bio: z.string().trim().max(600).nullish(),
  avatarUrl: z.string().max(200).nullish(),
  coverUrl: z.string().max(200).nullish(),
  location: z.string().trim().max(80).nullish(),
  interests: z.array(z.string().max(41)).max(MAX_INTERESTS).optional(),
  profileVisibility: z.enum(PROFILE_VISIBILITY as [string, ...string[]]).optional(),
  dmPolicy: z.enum(DM_POLICIES as [string, ...string[]]).optional(),
})

/** PATCH /api/vip/profile — edit profile, interests and privacy settings. */
export async function PATCH(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate
  const wait = memberRateLimit(req, 'profile', viewer.userId)
  if (wait) return vipJson({ error: 'Too many changes. Try again later.', retryAfter: wait }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const many = parsed.error.issues.some((i) => i.path[0] === 'interests')
    return vipJson({ error: many ? `Add up to ${MAX_INTERESTS} interests.` : 'Invalid profile' }, { status: 400 })
  }
  const { displayName, bio, avatarUrl, coverUrl, location, interests, profileVisibility, dmPolicy } = parsed.data
  if (avatarUrl && !isVipMediaUrl(avatarUrl)) {
    return vipJson({ error: 'Avatars must be uploaded through the clubhouse.' }, { status: 400 })
  }
  if (coverUrl && !isVipMediaUrl(coverUrl)) {
    return vipJson({ error: 'Cover photos must be uploaded through the clubhouse.' }, { status: 400 })
  }
  let tags: string[] | undefined
  if (interests) {
    tags = []
    for (const raw of interests) {
      const t = normaliseTag(raw)
      if (!t) return vipJson({ error: `“${raw.slice(0, 40)}” isn’t a valid interest. Use letters, numbers and _ (2–40).` }, { status: 400 })
      if (!tags.includes(t)) tags.push(t)
    }
  }
  const data = {
    ...(displayName !== undefined ? { displayName: displayName || null } : {}),
    ...(bio !== undefined ? { bio: bio || null } : {}),
    ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
    ...(coverUrl !== undefined ? { coverUrl: coverUrl || null } : {}),
    ...(location !== undefined ? { location: location || null } : {}),
    ...(profileVisibility !== undefined ? { profileVisibility } : {}),
    ...(dmPolicy !== undefined ? { dmPolicy } : {}),
  }
  await prisma.$transaction(async (tx) => {
    await tx.vipProfile.upsert({
      where: { userId: viewer.userId },
      update: data,
      create: { userId: viewer.userId, ...data },
    })
    if (tags) {
      await tx.vipInterest.deleteMany({ where: { userId: viewer.userId, ...(tags.length ? { tag: { notIn: tags } } : {}) } })
      if (tags.length) {
        await tx.vipInterest.createMany({ data: tags.map((tag) => ({ userId: viewer.userId, tag })), skipDuplicates: true })
      }
    }
  })
  return vipJson({ ok: true })
}
