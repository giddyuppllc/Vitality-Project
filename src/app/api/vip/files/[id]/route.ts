import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { canReadFile, readAdminFile } from '@/lib/vip/files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/vip/files/:id — an Academy / Library file, members only, and only
 * when the member may open a lesson or Library item that uses it. Unknown
 * and not-allowed both answer 404 (no probing for what exists).
 * ?download=1 forces a download; otherwise PDFs and media open inline.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return vipJson({ error: 'Not found' }, { status: 404 })
  const v = gate.viewer
  if (!(await canReadFile(id, v))) return vipJson({ error: 'Not found' }, { status: 404 })
  const file = await prisma.vipFile.findUnique({ where: { id } })
  const data = file ? await readAdminFile(file.storageKey) : null
  if (!file || !data) return vipJson({ error: 'Not found' }, { status: 404 })
  const download = req.nextUrl.searchParams.get('download') === '1'
  const ascii = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(data.length),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
