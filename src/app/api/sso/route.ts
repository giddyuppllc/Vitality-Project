import { NextRequest, NextResponse } from 'next/server'
import { consumeSsoToken, safeCallbackPath } from '@/lib/vip/sso-consume'
import { setSessionCookie } from '@/lib/vip/session'
import { logAudit } from '@/lib/audit'

// jsonwebtoken + prisma need node.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/sso?token=<jwt>&callbackUrl=/dashboard   (vitalityproject.vip only —
 * src/proxy.ts 404s this path on every other host)
 *
 * Consume side of the hand-off minted by .global's /clubhouse. Valid, unexpired,
 * never-used token → the same next-auth session cookie the store uses, issued
 * for the clubhouse host, then on to the requested page. Anything else →
 * /signin with an error flag (the member can sign in directly).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const result = await consumeSsoToken(token)

  const to = (path: string) => {
    const url = req.nextUrl.clone()
    url.pathname = path
    url.search = ''
    return url
  }

  if (!result.ok) {
    await logAudit({ action: 'vip.sso.rejected', metadata: { reason: result.reason } })
    const url = to('/signin')
    url.searchParams.set('error', result.reason === 'replayed' ? 'sso_used' : 'sso_invalid')
    const res = NextResponse.redirect(url)
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('Referrer-Policy', 'no-referrer')
    return res
  }

  const res = NextResponse.redirect(to(safeCallbackPath(req.nextUrl.searchParams.get('callbackUrl'))))
  await setSessionCookie(res, result.user)
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('Referrer-Policy', 'no-referrer')
  await logAudit({
    userId: result.user.id,
    userEmail: result.user.email,
    action: 'vip.sso.success',
  })
  return res
}
