import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeCredentials } from '@/lib/auth'
import { setSessionCookie } from '@/lib/vip/session'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  identifier: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
})

/**
 * POST /api/vip/auth/login — direct sign-in on vitalityproject.vip with the
 * same email/username + password as .global (same User table, same check:
 * authorizeCredentials in lib/auth.ts, which also writes the audit rows).
 */
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 'vip-login', { limit: 10, windowMs: 15 * 60_000 })
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  // JSON only — a cross-site <form> cannot send this content type without a
  // CORS preflight, which closes the login-CSRF hole.
  if (!(req.headers.get('content-type') || '').includes('application/json')) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  }
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email (or username) and password.' }, { status: 400 })
  }
  const user = await authorizeCredentials({
    email: parsed.data.identifier,
    password: parsed.data.password,
  })
  if (!user) {
    return NextResponse.json({ error: 'That email/username and password did not match.' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store')
  await setSessionCookie(res, { id: user.id, email: user.email, name: user.name, role: user.role })
  return res
}
