import { NextRequest, NextResponse } from 'next/server'
import { requireVipApi } from '@/lib/vip/access'
import { readMemberImage } from '@/lib/vip/media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/vip/media/YYYY-MM/<uuid>.jpg — members-only image delivery. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { path } = await params
  const bytes = await readMemberImage(path)
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Private: the browser may reuse it, a CDN must never store it.
      'Cache-Control': 'private, max-age=86400',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
