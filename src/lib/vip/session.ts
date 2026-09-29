import { encode } from 'next-auth/jwt'
import type { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, SESSION_COOKIE_SECURE } from '@/lib/auth'

/**
 * Issues the SAME next-auth JWT session cookie the store uses, but on the
 * clubhouse host (no Domain attribute → scoped to vitalityproject.vip).
 * getServerSession(authOptions) then reads it exactly as it does on .global,
 * so every server check in the app works unchanged against the one User row.
 *
 * Used by the SSO consume endpoint (/api/sso) and the clubhouse's direct
 * sign-in (/api/vip/auth/login). next-auth's own /api/auth/callback flow is
 * not used on .vip because it redirects to NEXTAUTH_URL (the .global origin).
 */

// next-auth's default JWT session lifetime (30 days).
export const VIP_SESSION_MAX_AGE = 30 * 24 * 60 * 60

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: string
}

export async function mintSessionToken(user: SessionUser): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return encode({
    secret,
    maxAge: VIP_SESSION_MAX_AGE,
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  })
}

export async function setSessionCookie(res: NextResponse, user: SessionUser): Promise<void> {
  const value = await mintSessionToken(user)
  res.cookies.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: SESSION_COOKIE_SECURE,
    maxAge: VIP_SESSION_MAX_AGE,
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: SESSION_COOKIE_SECURE,
    maxAge: 0,
  })
}
