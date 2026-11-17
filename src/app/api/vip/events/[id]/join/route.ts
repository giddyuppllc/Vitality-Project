import { NextRequest, NextResponse } from 'next/server'
import { requireVipApi } from '@/lib/vip/access'
import { eventAccess } from '@/lib/vip/classroom'
import { awardEventAttendance, isEventLive } from '@/lib/vip/events'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const noStore = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }

/**
 * GET /api/vip/events/:id/join — the Events page's "Join" button. Sends the
 * member on to the session's video link and, while the session is live,
 * records attendance: the `vip.points.event` earning rule, once per member
 * per session (key event:<eventId>:<userId>). The link itself is never put
 * in the page for members who don't meet the tier, and never after the end.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const access = await eventAccess(id, gate.viewer.accessTier)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore })
  if (!access.allowed) return NextResponse.json({ error: 'tier_required', minTier: access.event.minTier }, { status: 403, headers: noStore })
  const e = access.event
  const now = new Date()
  const ended = (e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3600e3)) < now
  if (!e.joinUrl || ended || !/^https:\/\//i.test(e.joinUrl)) {
    return NextResponse.redirect(new URL('/events', req.nextUrl), { status: 303, headers: noStore })
  }
  if (isEventLive(e, now)) {
    await awardEventAttendance(gate.viewer.userId, e.id).catch((err) => console.error('[vip/events] attendance points failed:', err))
  }
  return NextResponse.redirect(e.joinUrl, { status: 303, headers: noStore })
}
