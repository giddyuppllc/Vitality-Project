import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { eventAccess } from '@/lib/vip/classroom'
import { cancelRsvp, rsvpGoing, type RsvpState } from '@/lib/vip/events'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** { going, count } — plus { waitlisted, position } when the member is on the waitlist. */
function body(s: RsvpState) {
  return s.waitlisted ? { going: false, count: s.count, waitlisted: true, position: s.position } : { going: s.going, count: s.count }
}

/** POST /api/vip/events/:id/rsvp — I'm going (or join the waitlist when full). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const access = await eventAccess(id, gate.viewer.accessTier)
  if (!access) return vipJson({ error: 'Not found' }, { status: 404 })
  if (!access.allowed) return vipJson({ error: 'tier_required', minTier: access.event.minTier }, { status: 403 })
  const ended = (access.event.endsAt ?? new Date(access.event.startsAt.getTime() + 3 * 3600e3)) < new Date()
  if (ended) return vipJson({ error: 'This session has ended.' }, { status: 409 })
  return vipJson(body(await rsvpGoing(access.event, gate.viewer.userId)))
}

/** DELETE /api/vip/events/:id/rsvp — not going any more (frees a seat for the waitlist). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const access = await eventAccess(id, gate.viewer.accessTier)
  if (!access) return vipJson({ error: 'Not found' }, { status: 404 })
  return vipJson(body(await cancelRsvp(access.event, gate.viewer.userId)))
}
