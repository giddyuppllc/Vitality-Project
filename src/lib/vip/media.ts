import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

/**
 * Member image uploads (post images, avatars).
 *
 * Same normalisation as the admin uploader (api/admin/upload): decode by
 * content with sharp, honour EXIF rotation, downscale, re-encode to JPEG.
 * Re-encoding also DROPS all metadata (EXIF/GPS/device) — sharp only keeps it
 * when .withMetadata() is asked for, which it never is here.
 *
 * Unlike admin uploads these are PRIVATE: written outside public/, served
 * only through the members-only /api/vip/media/… route. Directory is
 * VIP_MEDIA_DIR, default <cwd>/private-uploads/vip (docker volume — see
 * docs/VIP_CLUBHOUSE.md).
 */

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const MAX_DIMENSION = 1600

export function mediaRoot(): string {
  return process.env.VIP_MEDIA_DIR || path.join(process.cwd(), 'private-uploads', 'vip')
}

/** Public-facing (members-only) URL shape. Anything else is rejected as an image URL. */
export const MEDIA_URL_RE = /^\/api\/vip\/media\/(\d{4}-\d{2})\/([0-9a-f-]{36})\.jpg$/

export function isVipMediaUrl(url: string | null | undefined): boolean {
  return !!url && MEDIA_URL_RE.test(url)
}

export async function saveMemberImage(
  input: Buffer,
): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  if (input.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'Image is too large (max 12MB).', status: 413 }
  }
  let processed: Buffer
  try {
    processed = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
  } catch {
    return { ok: false, error: 'That file is not a readable image.', status: 415 }
  }
  const now = new Date()
  const bucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const name = `${randomUUID()}.jpg`
  const dir = path.join(mediaRoot(), bucket)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), processed)
  return { ok: true, url: `/api/vip/media/${bucket}/${name}` }
}

/** Resolve a request path to a file INSIDE the media root, or null. */
export async function readMemberImage(segments: string[]): Promise<Buffer | null> {
  if (segments.length !== 2) return null
  const [bucket, file] = segments
  if (!/^\d{4}-\d{2}$/.test(bucket) || !/^[0-9a-f-]{36}\.jpg$/.test(file)) return null
  const root = path.resolve(mediaRoot())
  const full = path.resolve(root, bucket, file)
  if (!full.startsWith(root + path.sep)) return null
  try {
    return await readFile(full)
  } catch {
    return null
  }
}
