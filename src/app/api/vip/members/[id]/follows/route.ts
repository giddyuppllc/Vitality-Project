import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { listFollows, loadProfile } from '@/lib/vip/social'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vip/members/:id/follows?which=followers|following — a member's
 * followers or the people they follow. Follows the profile's privacy: a
 * followers-only profile lists these to its followers (and the team) only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const profile = await loadProfile(gate.viewer, id)
  if (!profile) return vipJson({ error: 'Not found' }, { status: 404 })
  if (!profile.full) return vipJson({ error: 'This profile is visible to followers only.' }, { status: 403 })
  const which = req.nextUrl.searchParams.get('which') === 'following' ? 'following' : 'followers'
  const members = await listFollows(gate.viewer, profile.card.id, which)
  return vipJson({ which, members })
}
