import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('ref')
  const redirect = searchParams.get('to') ?? '/'

  if (!code) {
    return NextResponse.redirect(new URL(redirect, req.url))
  }

  // Cap per-IP click recording so a single source can't spray click rows /
  // commission cookies. When over the limit we still redirect the visitor
  // (never break the user-facing link) but skip the DB write + cookie set.
  const limited = checkRateLimit(req, 'affiliate-track', { limit: 30, windowMs: 60_000 })
  if (!limited.allowed) {
    return NextResponse.redirect(new URL(redirect, req.url))
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { code: code.toUpperCase(), status: 'ACTIVE' },
  })

  if (!affiliate) {
    return NextResponse.redirect(new URL(redirect, req.url))
  }

  // Record click with server-side session ID (immune to ad blockers)
  const sessionId = req.cookies.get('session_id')?.value ?? crypto.randomUUID()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''
  const referrer = req.headers.get('referer') ?? ''

  await prisma.affiliateClick.create({
    data: {
      affiliateId: affiliate.id,
      ip,
      userAgent,
      referrer,
      sessionId,
    },
  })

  // Update click count
  await prisma.affiliateLink.updateMany({
    where: { affiliateId: affiliate.id },
    data: { clicks: { increment: 1 } },
  })

  // Set affiliate cookie (30 days, server-side)
  const cookieStore = cookies()
  const days = parseInt(process.env.AFFILIATE_COOKIE_DAYS ?? '30')
  const response = NextResponse.redirect(new URL(redirect, req.url))
  response.cookies.set('aff_code', code.toUpperCase(), {
    maxAge: days * 24 * 60 * 60,
    httpOnly: false, // needs to be readable by JS for checkout
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
