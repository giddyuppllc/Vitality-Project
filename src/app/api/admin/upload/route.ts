import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

export const runtime = 'nodejs'

// Raw upload cap — generous because phone photos (especially iPhone HEIC /
// high-res) routinely run 5–15MB. We re-encode + downscale below, so the
// STORED file is small regardless. Keep in sync with nginx
// client_max_body_size (docker/nginx/nginx.conf).
const MAX_BYTES = 25 * 1024 * 1024 // 25MB
const MAX_DIMENSION = 2000 // px — plenty for product cards + zoom

/**
 * POST /api/admin/upload
 *
 * Accepts a multipart image upload from the admin product editor (or any other
 * admin form), normalizes it, writes it under
 * /public/uploads/YYYY-MM/<uuid>.jpg, and returns the public URL.
 *
 * Phone-friendly: instead of an allow-list of MIME types (which rejected
 * iPhone HEIC outright), we hand the bytes to sharp. Its bundled libvips
 * decodes HEIC/HEIF, JPEG, PNG, WebP, GIF, TIFF and AVIF — so "Take Photo" on
 * an iPhone works. We auto-rotate per EXIF, downscale to <=2000px, and
 * re-encode to optimized JPEG, which also keeps multi-MB phone photos small.
 *
 * Volume ./public/uploads is mounted into the container per docker-compose.yml
 * so files persist across image rebuilds. Auth: admin only.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 25MB)` },
      { status: 413 },
    )
  }

  const input = Buffer.from(await file.arrayBuffer())

  // Decode by content, not by claimed MIME type — phones sometimes mislabel
  // HEIC as application/octet-stream. Anything sharp can't read isn't a usable
  // image, so reject it with a clear message.
  let processed: Buffer
  try {
    processed = await sharp(input, { failOn: 'none' })
      .rotate() // honor EXIF orientation so phone photos aren't sideways
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  } catch {
    return NextResponse.json(
      { error: 'That file is not a readable image. Use a JPG, PNG, WebP, or an iPhone photo.' },
      { status: 415 },
    )
  }

  // Bucket by year-month so a directory listing stays scannable.
  const now = new Date()
  const bucket = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const filename = `${randomUUID()}.jpg` // always JPEG after normalization

  const dir = path.join(process.cwd(), 'public', 'uploads', bucket)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), processed)

  const url = `/uploads/${bucket}/${filename}`
  return NextResponse.json({
    url,
    size: processed.length,
    type: 'image/jpeg',
    name: file.name,
  })
}
