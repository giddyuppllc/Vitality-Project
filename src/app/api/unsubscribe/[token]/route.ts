import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publicUrl } from '@/lib/public-url'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'

export const dynamic = 'force-dynamic'

/**
 * Marketing-email unsubscribe for registered customers (the link in admin
 * campaign emails). Turns off marketingEmail on their communication
 * preferences; transactional email (orders, shipping) is unaffected.
 * GET = the link; POST = RFC 8058 one-click from mail clients.
 */
async function unsubscribe(req: NextRequest, token: string) {
  const userId = verifyUnsubscribeToken(token)
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (user) {
      await prisma.communicationPreference.upsert({
        where: { userId },
        create: { userId, marketingEmail: false },
        update: { marketingEmail: false },
      })
    }
  }
  return userId
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await unsubscribe(req, token)
  return NextResponse.redirect(new URL('/unsubscribed', new URL(publicUrl(req, '/')).origin))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ok = await unsubscribe(req, token)
  return NextResponse.json({ ok: Boolean(ok) }, { status: ok ? 200 : 400 })
}
