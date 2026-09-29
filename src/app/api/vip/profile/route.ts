import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'
import { isVipMediaUrl } from '@/lib/vip/media'

export const dynamic = 'force-dynamic'

/** GET /api/vip/profile — the viewer's own clubhouse profile. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const profile = await prisma.vipProfile.findUnique({
    where: { userId: gate.viewer.userId },
    select: { displayName: true, bio: true, avatarUrl: true },
  })
  return vipJson({ profile: profile ?? { displayName: null, bio: null, avatarUrl: null } })
}

const schema = z.object({
  displayName: z.string().trim().max(60).nullish(),
  bio: z.string().trim().max(600).nullish(),
  avatarUrl: z.string().max(200).nullish(),
})

/** PATCH /api/vip/profile — edit display name, bio, avatar. */
export async function PATCH(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate
  const wait = memberRateLimit(req, 'profile', viewer.userId)
  if (wait) return vipJson({ error: 'Too many changes. Try again later.', retryAfter: wait }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid profile' }, { status: 400 })
  const { displayName, bio, avatarUrl } = parsed.data
  if (avatarUrl && !isVipMediaUrl(avatarUrl)) {
    return vipJson({ error: 'Avatars must be uploaded through the clubhouse.' }, { status: 400 })
  }
  const data = {
    ...(displayName !== undefined ? { displayName: displayName || null } : {}),
    ...(bio !== undefined ? { bio: bio || null } : {}),
    ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
  }
  await prisma.vipProfile.upsert({
    where: { userId: viewer.userId },
    update: data,
    create: { userId: viewer.userId, ...data },
  })
  return vipJson({ ok: true })
}
