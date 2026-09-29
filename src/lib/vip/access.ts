import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import type { MembershipTier } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, TIER_BENEFITS } from '@/lib/membership'

/**
 * Who may see what on the clubhouse.
 *
 * Membership is NOT re-implemented here: `getUserMembership()` (lib/membership)
 * is the one source of truth — it resolves the tier to NONE unless the
 * membership status is ACTIVE, so PENDING_PAYMENT, PAST_DUE (the lapse
 * lifecycle in lib/membershipLapse.ts), PAUSED and CANCELLED all lose access
 * the same moment they lose their store benefits.
 *
 * Community suspension (VipProfile.suspendedAt) is separate: a suspended
 * member keeps classroom/events/rewards (paid benefits) but loses the
 * community (feed, comments, reactions, directory, profiles, notifications).
 */

export const TIER_RANK: Record<MembershipTier, number> = { NONE: 0, CLUB: 1, PLUS: 2, PREMIUM: 3 }

export const PAID_TIERS = ['CLUB', 'PLUS', 'PREMIUM'] as const

export function tierLabel(tier: MembershipTier): string {
  return TIER_BENEFITS[tier].label
}

/** Does a member on `tier` meet a `minTier` requirement? NONE never does. */
export function tierAllows(tier: MembershipTier, minTier: MembershipTier): boolean {
  if (tier === 'NONE') return false
  return TIER_RANK[tier] >= TIER_RANK[minTier === 'NONE' ? 'CLUB' : minTier]
}

export interface VipViewer {
  userId: string
  email: string
  name: string | null
  username: string | null
  role: string
  isAdmin: boolean
  /** Membership tier as resolved by getUserMembership (NONE unless ACTIVE). */
  tier: MembershipTier
  /** Tier used for content gating — admins see everything. */
  accessTier: MembershipTier
  membershipStatus: string | null
  isMember: boolean
  suspended: boolean
  joinedAt: Date | null
  displayName: string
  avatarUrl: string | null
  /** Welcome email already sent (VipProfile.welcomeEmailAt). */
  welcomed: boolean
  /** "Start here" checklist dismissed. */
  onboarded: boolean
}

export async function loadVipViewer(userId: string): Promise<VipViewer | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      vipProfile: { select: { displayName: true, avatarUrl: true, suspendedAt: true, welcomeEmailAt: true, onboardedAt: true } },
    },
  })
  if (!user) return null
  const { tier, membership } = await getUserMembership(user.id)
  const isAdmin = user.role === 'ADMIN'
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    isAdmin,
    tier,
    accessTier: isAdmin ? 'PREMIUM' : tier,
    membershipStatus: membership?.status ?? null,
    isMember: isAdmin || tier !== 'NONE',
    suspended: !!user.vipProfile?.suspendedAt && !isAdmin,
    joinedAt: membership?.paymentConfirmedAt ?? membership?.startedAt ?? null,
    displayName: user.vipProfile?.displayName || user.name || user.username || 'Member',
    avatarUrl: user.vipProfile?.avatarUrl ?? null,
    welcomed: !!user.vipProfile?.welcomeEmailAt,
    onboarded: !!user.vipProfile?.onboardedAt,
  }
}

export async function getVipViewer(): Promise<VipViewer | null> {
  const session = await getServerSession(authOptions)
  const id = session?.user?.id
  if (!id) return null
  return loadVipViewer(id)
}

/** Every clubhouse API response is private and never cached by a CDN. */
export function vipJson(data: unknown, init: { status?: number } = {}) {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

export type VipGate = 'member' | 'community'

/**
 * API gate. Returns the viewer, or a ready 401/403 response.
 *  - 'member':    active membership (or admin)
 *  - 'community': member AND not suspended from the community
 */
export async function requireVipApi(
  gate: VipGate,
): Promise<{ viewer: VipViewer; response?: undefined } | { viewer?: undefined; response: NextResponse }> {
  const viewer = await getVipViewer()
  if (!viewer) return { response: vipJson({ error: 'unauthenticated' }, { status: 401 }) }
  if (!viewer.isMember) return { response: vipJson({ error: 'membership_required' }, { status: 403 }) }
  if (gate === 'community' && viewer.suspended) {
    return { response: vipJson({ error: 'community_suspended' }, { status: 403 }) }
  }
  return { viewer }
}

/** Admin gate for /api/admin/vip/* — same rule as every existing admin API. */
export async function requireAdminApi(): Promise<
  { userId: string; response?: undefined } | { userId?: undefined; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { userId: session.user.id }
}
