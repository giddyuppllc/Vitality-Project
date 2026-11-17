import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findCustomersBySegment, parseSegmentFilters, stringifySegmentFilters } from '@/lib/segments'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/segments/preview  { filters }  ->  { total }
 *
 * Counts who matches a filter set WITHOUT saving anything. The segment
 * builder's Preview used to PATCH the filters into the saved segment (so
 * Preview + Cancel had already changed it) or, for a new segment, create and
 * delete a throwaway row (audit-log noise).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const raw = body && typeof body === 'object' ? (body as { filters?: unknown }).filters : null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Send { filters: {...} }' }, { status: 400 })
  }
  // Same normalisation a save applies (stringify -> parse).
  const filters = parseSegmentFilters(stringifySegmentFilters(raw as Parameters<typeof stringifySegmentFilters>[0]))
  const { total } = await findCustomersBySegment(filters, { limit: 1, offset: 0 })
  return NextResponse.json({ total })
}
