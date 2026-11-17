import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { readMemberImage } from '@/lib/vip/media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/vip/media/YYYY-MM/<uuid>.jpg?c=<conversationId> — a photo
 * sent in a REPORTED conversation, for the admin review page (the members'
 * media route does not answer on the admin host). Refused unless the photo
 * belongs to a message in that conversation and the conversation has a report.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const { path } = await params
  const conversationId = req.nextUrl.searchParams.get('c') ?? ''
  const url = `/api/vip/media/${path.join('/')}`
  const allowed = conversationId
    ? await prisma.vipMessage.count({
        where: { conversationId, imageUrl: url, conversation: { reports: { some: {} } } },
      })
    : 0
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const bytes = await readMemberImage(path)
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
