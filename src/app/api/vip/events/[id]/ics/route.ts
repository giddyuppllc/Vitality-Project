import { NextRequest, NextResponse } from 'next/server'
import { requireVipApi } from '@/lib/vip/access'
import { eventAccess } from '@/lib/vip/classroom'
import { eventIcs } from '@/lib/vip/events'
import { vipBaseUrl } from '@/lib/vip/email-prefs'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/vip/events/:id/ics — add-to-calendar file for a published event. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const access = await eventAccess(id, gate.viewer.accessTier)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  const e = access.event
  const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event'
  return new NextResponse(eventIcs(e, vipBaseUrl()), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
