import { NextRequest } from 'next/server'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'
import { MAX_UPLOAD_BYTES } from '@/lib/vip/media'
import { saveProgressPhoto, listProgressPhotos } from '@/lib/vip/fitness/photos'
import { resolveTimeZone, todayIn } from '@/lib/vip/fitness/profile'
import { daysBetween, isValidDate } from '@/lib/vip/fitness/dates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POSES = new Set(['front', 'side', 'back'])

/** GET — the member's own progress photos (ids + dates only). */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  return vipJson({ photos: await listProgressPhotos(gate.viewer.userId) })
}

/**
 * POST (multipart: file, date?, pose?, tz?) — a private progress photo. Only
 * the member who uploads it can ever load it again.
 */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const wait = memberRateLimit(req, 'upload', gate.viewer.userId)
  if (wait) return vipJson({ error: 'Too many uploads. Try again later.', retryAfter: wait }, { status: 429 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return vipJson({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return vipJson({ error: 'Image is too large (max 12MB).' }, { status: 413 })

  const tz = await resolveTimeZone(gate.viewer.userId, form?.get('tz'))
  const today = todayIn(tz)
  const rawDate = form?.get('date')
  const date = typeof rawDate === 'string' && isValidDate(rawDate) ? rawDate : today
  if (daysBetween(date, today) < 0) return vipJson({ error: 'That date is in the future' }, { status: 400 })
  const rawPose = form?.get('pose')
  const pose = typeof rawPose === 'string' && POSES.has(rawPose) ? rawPose : null

  const saved = await saveProgressPhoto(gate.viewer.userId, Buffer.from(await file.arrayBuffer()), { date, pose })
  if (!saved.ok) return vipJson({ error: saved.error }, { status: saved.status })
  return vipJson({ id: saved.id }, { status: 201 })
}
