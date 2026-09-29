import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/vip/session'

export const dynamic = 'force-dynamic'

/** POST /api/vip/auth/logout — clears the clubhouse session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store')
  clearSessionCookie(res)
  return res
}
