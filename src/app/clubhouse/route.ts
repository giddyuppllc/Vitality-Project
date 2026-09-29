import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mintSsoToken } from '@/lib/sso'

// node runtime — jsonwebtoken needs it.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VIP_URL = process.env.NEXT_PUBLIC_VIP_URL || 'https://vitalityproject.vip'

/**
 * "Visit your clubhouse" entry point (docs on the .vip side: VIP_ARCHITECTURE.md
 * §3). Mints a single-use, short-lived SSO token for the signed-in member and
 * bounces them to vitalityproject.vip/api/sso, which materialises a .vip session
 * against the shared user table. No shared cookie needed across the two TLDs.
 *
 *   signed out      → login, then back here
 *   not a member    → /membership (join/upgrade first)
 *   active member   → mint token → .vip clubhouse
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/login?callbackUrl=/clubhouse', req.url))
  }

  const membership = await prisma.membership.findUnique({
    where: { userId: session.user.id },
    select: { tier: true, status: true },
  })
  const active = membership && membership.tier !== 'NONE' && membership.status === 'ACTIVE'
  if (!active) {
    return NextResponse.redirect(new URL('/membership', req.url))
  }

  let token: string
  try {
    token = mintSsoToken({ sub: session.user.id, email: session.user.email ?? undefined })
  } catch {
    // VIP_SSO_SECRET not configured — fall back to the .vip landing (member can
    // sign in there directly) rather than erroring.
    return NextResponse.redirect(`${VIP_URL}/`)
  }

  const url = `${VIP_URL}/api/sso?token=${encodeURIComponent(token)}&callbackUrl=/dashboard`
  return NextResponse.redirect(url)
}
