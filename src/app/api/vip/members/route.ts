import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { blockedIdSet } from '@/lib/vip/blocks'
import { listMembers } from '@/lib/vip/members'

export const dynamic = 'force-dynamic'

/** GET /api/vip/members?q= — member directory (members only; name, username or interest). */
export async function GET(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const hidden = await blockedIdSet(gate.viewer.userId)
  const members = await listMembers(req.nextUrl.searchParams.get('q'), { excludeIds: hidden })
  return vipJson({ members })
}
