import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { blockedIdSet } from '@/lib/vip/blocks'
import { listMembers } from '@/lib/vip/members'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vip/members/suggest?q=&mentionable=1 — a short list of members for
 * @mention autocomplete and the message pickers. mentionable=1 keeps only
 * members with a username (mentions link by username). Never yourself or
 * anyone blocked either way.
 */
export async function GET(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').slice(0, 40)
  const hidden = await blockedIdSet(gate.viewer.userId)
  const rows = await listMembers(q, { excludeIds: [...hidden, gate.viewer.userId], take: 30 })
  const filtered = sp.get('mentionable') === '1' ? rows.filter((m) => m.username) : rows
  return vipJson({
    members: filtered.slice(0, 8).map((m) => ({
      id: m.id,
      displayName: m.displayName,
      username: m.username,
      avatarUrl: m.avatarUrl,
      tier: m.tier,
      isAdmin: m.isAdmin,
    })),
  })
}
