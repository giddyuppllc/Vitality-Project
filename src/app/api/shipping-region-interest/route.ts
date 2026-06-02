import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 'shipping-region-interest', { limit: 5, windowMs: 60_000 })
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const country = typeof body?.country === 'string' ? body.country.trim().toUpperCase() : ''
    const state = typeof body?.state === 'string' ? body.state.trim() || null : null

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 })
    }
    if (!country || country.length > 60) {
      return NextResponse.json({ error: 'Please select your country' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = req.headers.get('user-agent') || null

    await prisma.shippingRegionInterest.create({
      data: { email, country, state, source: 'checkout-banner', ip, userAgent },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[shipping-region-interest]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
