import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { TRAINER_ATTRIBUTION_COOKIE, TRAINER_ATTRIBUTION_COOKIE_MAX_AGE_S } from '@/lib/trainer'

/**
 * /join/<code> — trainer attribution landing.
 *
 * - Validates the code against an active OrgMember
 * - Sets a 30-day cookie so the next /auth/register POST attaches an
 *   OrgClient row with trainerOrgMemberId pointing back here
 * - Bounces to /auth/register pre-filled with the trainer + gym info
 *   (or /auth/login if the user is already signed in — in which case we
 *   attribute them on the spot)
 *
 * This is intentionally a server-only page — no JS needed for the cookie
 * to work, and the redirect happens before any HTML renders.
 */
export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const normalized = code.trim().toUpperCase()

  const trainer = await prisma.orgMember.findUnique({
    where: { referralCode: normalized },
    include: {
      organization: { select: { name: true, slug: true, status: true } },
      user: { select: { name: true } },
    },
  })

  // Invalid / disabled / suspended → boomerang to home
  if (!trainer || trainer.organization.status !== 'ACTIVE') {
    redirect('/?invalid_invite=1')
  }

  // Set the attribution cookie — picked up on next register / checkout
  const cookieStore = await cookies()
  cookieStore.set({
    name: TRAINER_ATTRIBUTION_COOKIE,
    value: normalized,
    maxAge: TRAINER_ATTRIBUTION_COOKIE_MAX_AGE_S,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })

  // Bounce to register with the trainer + gym hinted in the URL so the page
  // can render "Joining via <Trainer> at <Gym>" badge
  const params2 = new URLSearchParams({
    via: trainer.user.name || 'trainer',
    org: trainer.organization.name,
  })
  redirect(`/auth/register?${params2.toString()}`)
}
