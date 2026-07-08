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
    return NextResponse.redirect(new URL('/unsubscribed', origin))
  }

  const subscriber = await prisma.newsletterSubscriber.findFirst({
    where: { confirmToken: token },
  })

  if (subscriber) {
    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { unsubscribed: true },
    })
  }

  return NextResponse.redirect(new URL('/unsubscribed', origin))
}
