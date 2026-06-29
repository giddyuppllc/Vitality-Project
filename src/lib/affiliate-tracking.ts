import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Records an affiliate click + sets the tracking cookies, then returns a
 * redirect response to the destination URL. Used by every affiliate landing
 * route (`/r/<code>`, `/ref/<code>`, `/api/affiliate/track`, `/r/<code>/<slug>`).
 *
 * Behavior:
 *  - Unknown/inactive code → still redirects (so a bad link doesn't 404 a
 *    visitor) but skips click recording.
 *  - Records AffiliateClick row + bumps AffiliateLink.clicks for the matched
 *    slug (when present).
 *  - Sets `aff_code` (JS-readable, used by checkout to attach commission)
 *    and `session_id` (httpOnly, used for de-dup on conversion).
 */
export async function recordClickAndRedirect(
  req: NextRequest,
  code: string,
  destination: string,
  opts: { slug?: string | null } = {},
) {
  const normalized = code.toUpperCase()
  // Build the absolute redirect URL using the public proxy headers — inside
  // Docker `req.url` resolves to `http://0.0.0.0:3000` which Cloudflare won't
  // accept as a Location target.
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    'vitalityproject.global'
  const base = `${proto}://${host}`
  const dest = destination.startsWith('http')
    ? destination
    : new URL(destination, base).toString()
  const sessionId = req.cookies.get('session_id')?.value ?? crypto.randomUUID()

  const affiliate = await prisma.affiliate.findUnique({
    where: { code: normalized },
  })

  // Truly unknown code — just redirect (nothing to attribute).
  if (!affiliate) {
    return NextResponse.redirect(dest)
  }

  // Record the click only for ACTIVE affiliates — but the cookie below is set
  // for ANY existing affiliate, so a PENDING affiliate approved before the
  // visitor checks out still earns the attribution. Checkout only CREDITS
  // active affiliates, so this can never over-attribute.
  if (affiliate.status === 'ACTIVE') {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'
    const userAgent = req.headers.get('user-agent') ?? ''
    const referrer = req.headers.get('referer') ?? ''

    try {
      await prisma.affiliateClick.create({
        data: { affiliateId: affiliate.id, ip, userAgent, referrer, sessionId },
      })

      if (opts.slug) {
        await prisma.affiliateLink.updateMany({
          where: { affiliateId: affiliate.id, slug: opts.slug },
          data: { clicks: { increment: 1 } },
        })
      } else {
        // No slug supplied — bump the base affiliate's first link if one exists.
        await prisma.affiliateLink.updateMany({
          where: { affiliateId: affiliate.id },
          data: { clicks: { increment: 1 } },
        })
      }
    } catch (err) {
      console.error('[affiliate-tracking] click record failed:', err)
    }
  }

  const days = parseInt(process.env.AFFILIATE_COOKIE_DAYS ?? '30')
  const response = NextResponse.redirect(dest)
  response.cookies.set('aff_code', normalized, {
    maxAge: days * 24 * 60 * 60,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  })
  response.cookies.set('session_id', sessionId, {
    maxAge: days * 24 * 60 * 60,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return response
}
