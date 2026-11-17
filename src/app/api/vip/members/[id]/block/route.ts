import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'
import { blockMember, unblockMember } from '@/lib/vip/social'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/vip/members/:id/block — block a member. Both sides stop seeing
 * each other's posts, comments, profile and messages; follows between them
 * are removed.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const wait = memberRateLimit(req, 'block', gate.viewer.userId)
  if (wait) return vipJson({ error: 'Slow down a little.', retryAfter: wait }, { status: 429 })
  const { id } = await params
  const r = await blockMember(gate.viewer, id)
  if (!r.ok) return vipJson({ error: r.error }, { status: r.status })
  return vipJson({ ok: true, blocked: true })
}

/** DELETE /api/vip/members/:id/block — unblock (follows are not restored). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  await unblockMember(gate.viewer, id)
  return vipJson({ ok: true, blocked: false })
}
