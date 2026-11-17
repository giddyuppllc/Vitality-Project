import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/vip/access'
import { MAX_UPLOAD_BYTES, saveMemberImage } from '@/lib/vip/media'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/vip/rewards/upload (multipart "file") — a reward or partner
 * logo image for the clubhouse. Stored with the clubhouse's private media
 * (re-encoded, metadata stripped) and served to members at /api/vip/media/…
 * on vitalityproject.vip.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'Image is too large (max 12MB).' }, { status: 413 })
  const saved = await saveMemberImage(Buffer.from(await file.arrayBuffer()))
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status })
  await logAudit({ userId: gate.userId, action: 'vip.rewards.upload', metadata: { url: saved.url } })
  return NextResponse.json({ url: saved.url }, { status: 201 })
}
