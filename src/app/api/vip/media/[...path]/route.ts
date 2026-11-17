import { NextRequest, NextResponse } from 'next/server'
import { requireVipApi } from '@/lib/vip/access'
import { readMemberImage } from '@/lib/vip/media'
import { messageImageAccess } from '@/lib/vip/messages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/vip/media/YYYY-MM/<uuid>.jpg — members-only image delivery; DM photos to that conversation's participants only. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { path } = await params
  // Direct-message photos: participants of that conversation only (admins
  // review reported ones through /api/admin/vip/media). Same 404 as a missing
  // file, so a link can't even be confirmed to exist.
  const access = await messageImageAccess(gate.viewer, `/api/vip/media/${path.join('/')}`)
  if (access === 'denied') return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  const bytes = await readMemberImage(path)
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Private: the browser may reuse it, a CDN must never store it. A DM
      // photo is never kept (leaving a group must end access).
      'Cache-Control': access === 'allowed' ? 'private, no-store' : 'private, max-age=86400',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
