import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'
import { MAX_UPLOAD_BYTES, saveMemberImage } from '@/lib/vip/media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/vip/uploads (multipart "file") — a member image for a post or an
 * avatar. Stored privately; the returned URL only resolves for members.
 */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const wait = memberRateLimit(req, 'upload', gate.viewer.userId)
  if (wait) return vipJson({ error: 'Too many uploads. Try again later.', retryAfter: wait }, { status: 429 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return vipJson({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return vipJson({ error: 'Image is too large (max 12MB).' }, { status: 413 })

  const saved = await saveMemberImage(Buffer.from(await file.arrayBuffer()))
  if (!saved.ok) return vipJson({ error: saved.error }, { status: saved.status })
  return vipJson({ url: saved.url }, { status: 201 })
}
