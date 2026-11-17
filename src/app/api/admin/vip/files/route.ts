import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/vip/access'
import { MAX_DOC_BYTES, saveAdminFile } from '@/lib/vip/files'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/vip/files (multipart "file") — upload a lesson / Library
 * file (PDF, PNG, JPEG, MP3, M4A, MP4; max 25MB). Stored privately; members
 * reach it only through /api/vip/files/<id>, and only once a lesson or
 * Library item that they can open references it.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_DOC_BYTES) return NextResponse.json({ error: 'File is too large (max 25MB).' }, { status: 413 })
  const saved = await saveAdminFile(Buffer.from(await file.arrayBuffer()), file.name || 'download', gate.userId)
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status })
  await logAudit({ userId: gate.userId, action: 'vip.file.upload', entityType: 'VipFile', entityId: saved.file.id })
  return NextResponse.json({ ok: true, file: saved.file }, { status: 201 })
}
