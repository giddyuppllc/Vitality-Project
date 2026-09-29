import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { listMembers } from '@/lib/vip/members'

export const dynamic = 'force-dynamic'

/** GET /api/vip/members?q= — member directory (members only). */
export async function GET(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const members = await listMembers(req.nextUrl.searchParams.get('q'))
  return vipJson({ members })
}
