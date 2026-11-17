import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'
import { followMember, unfollowMember } from '@/lib/vip/social'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/vip/members/:id/follow — follow a member. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const wait = memberRateLimit(req, 'follow', gate.viewer.userId)
  if (wait) return vipJson({ error: 'Slow down a little.', retryAfter: wait }, { status: 429 })
  const { id } = await params
  const r = await followMember(gate.viewer, id)
  if (!r.ok) return vipJson({ error: r.error }, { status: r.status })
  return vipJson({ ok: true, following: true })
}

/** DELETE /api/vip/members/:id/follow — unfollow. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  await unfollowMember(gate.viewer, id)
  return vipJson({ ok: true, following: false })
}
