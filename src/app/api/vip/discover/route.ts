import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { blockedIdSet } from '@/lib/vip/blocks'
import { listMembers } from '@/lib/vip/members'
import { searchHashtags, trendingHashtags } from '@/lib/vip/hashtags'
import { suggestedMembers } from '@/lib/vip/social'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vip/discover?q= — member search (name, username, interests),
 * hashtag search, trending hashtags (last 7 days) and members to follow.
 */
export async function GET(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60)
  const hidden = await blockedIdSet(gate.viewer.userId)
  const [members, tags, trending, suggested] = await Promise.all([
    q ? listMembers(q, { excludeIds: hidden, take: 30 }) : Promise.resolve([]),
    q ? searchHashtags(q) : Promise.resolve([]),
    trendingHashtags({ days: 7, take: 10 }),
    suggestedMembers(gate.viewer, 6),
  ])
  return vipJson({ q, members, tags, trending, suggested })
}
