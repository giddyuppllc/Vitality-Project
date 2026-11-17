import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { normaliseMemberImage } from '@/lib/vip/media'

/**
 * Progress photos — the most private thing a member gives us.
 *
 * Same normalisation as every member upload (lib/vip/media.ts: decoded by
 * content, EXIF/GPS stripped by the JPEG re-encode), but stored in their OWN
 * folder, private-uploads/vip-progress/<userId>/<uuid>.jpg — never in the
 * shared member-media folder that /api/vip/media serves to every member, and
 * never under public/. The only way to read one is
 * /api/vip/fitness/photos/<id>, which serves it to the member who took it and
 * to nobody else (not other members, not admins).
 */

const KEY_RE = /^(c[a-z0-9]{8,40})\/([0-9a-f-]{36})$/
export const MAX_PHOTOS_PER_MEMBER = 500

function filePath(userId: string, name?: string): string {
  return name
    ? path.join(process.cwd(), 'private-uploads', 'vip-progress', userId, name)
    : path.join(process.cwd(), 'private-uploads', 'vip-progress', userId)
}

export async function saveProgressPhoto(
  userId: string,
  input: Buffer,
  meta: { date: string; pose?: string | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  if (!/^c[a-z0-9]{8,40}$/.test(userId)) return { ok: false, error: 'Bad user', status: 400 }
  const count = await prisma.vipProgressPhoto.count({ where: { userId } })
  if (count >= MAX_PHOTOS_PER_MEMBER) return { ok: false, error: 'Photo limit reached. Delete an old photo first.', status: 409 }
  const norm = await normaliseMemberImage(input)
  if (!norm.ok) return norm
  const uuid = randomUUID()
  await mkdir(filePath(userId), { recursive: true })
  await writeFile(filePath(userId, `${uuid}.jpg`), norm.jpeg)
  const row = await prisma.vipProgressPhoto.create({
    data: { userId, date: meta.date, pose: meta.pose || null, fileKey: `${userId}/${uuid}` },
  })
  return { ok: true, id: row.id }
}

/** The photo bytes, ONLY if `viewerId` owns it. */
export async function readProgressPhoto(id: string, viewerId: string): Promise<Buffer | null> {
  const row = await prisma.vipProgressPhoto.findUnique({ where: { id } })
  if (!row || row.userId !== viewerId) return null
  const m = KEY_RE.exec(row.fileKey)
  if (!m || m[1] !== row.userId) return null
  try {
    return await readFile(filePath(m[1], `${m[2]}.jpg`))
  } catch {
    return null
  }
}

export async function deleteProgressPhoto(id: string, viewerId: string): Promise<boolean> {
  const row = await prisma.vipProgressPhoto.findUnique({ where: { id } })
  if (!row || row.userId !== viewerId) return false
  await prisma.vipProgressPhoto.delete({ where: { id } })
  const m = KEY_RE.exec(row.fileKey)
  if (m) await unlink(filePath(m[1], `${m[2]}.jpg`)).catch(() => {})
  return true
}

export async function listProgressPhotos(userId: string) {
  return prisma.vipProgressPhoto.findMany({
    where: { userId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: { id: true, date: true, pose: true },
  })
}
