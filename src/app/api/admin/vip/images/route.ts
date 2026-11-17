import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/vip/access'
import { MAX_UPLOAD_BYTES, saveMemberImage } from '@/lib/vip/media'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/vip/images (multipart "file") — a picture for clubhouse
 * content: course covers, program / challenge / article covers, exercise
 * images, reward images, partner logos. `public/` is not served on .vip, so
 * these go into the clubhouse's private media store (re-encoded, metadata
 * stripped) and are shown to signed-in members only, at /api/vip/media/… on
 * vitalityproject.vip — no outside hosting needed. Documents (PDFs, audio)
 * stay on /api/admin/vip/files, which checks per-lesson access.
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
  await logAudit({ userId: gate.userId, action: 'vip.image.upload', metadata: { url: saved.url } })
  return NextResponse.json({ url: saved.url }, { status: 201 })
}
