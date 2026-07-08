import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const origin = new URL(req.url).origin

  if (!token) {
    return NextResponse.redirect(new URL('/', origin))
  }

  const subscriber = await prisma.newsletterSubscriber.findFirst({
    where: { confirmToken: token },
  })

  if (!subscriber) {
    return NextResponse.redirect(new URL('/newsletter/confirmed?status=invalid', origin))
  }

  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: {
      confirmed: true,
      unsubscribed: false,
    },
  })

  // Mark this browser as a known subscriber so the exit-intent modal
  // stops pestering them on this device. 1-year cookie since they
  // explicitly opted in. The exit-intent gate just checks for presence
  // — value doesn't matter, but `1` keeps it short.
  const res = NextResponse.redirect(new URL('/newsletter/confirmed', origin))
  res.cookies.set('vp_news', '1', {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
