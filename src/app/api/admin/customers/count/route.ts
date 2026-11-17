import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { audienceRecipients } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/customers/count[?segmentId=]
 * How many people a campaign to this audience would actually mail (marketing
 * opt-outs excluded). The campaign builder's "count" button called this route
 * but it did not exist, so the preview was always "unavailable".
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const segmentId = req.nextUrl.searchParams.get('segmentId') || null
  const users = await audienceRecipients(segmentId)
  return NextResponse.json({ count: users.filter((u) => Boolean(u.email)).length })
}
