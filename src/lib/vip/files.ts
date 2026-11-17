import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from './access'
import { allowsTier, grantedCourseIds } from './academy'

/**
 * Admin-uploaded Academy / Library files (lesson PDFs, guides, audio).
 *
 * Stored PRIVATELY under <cwd>/private-uploads/vip-docs (the same docker
 * volume as member images — docs/VIP_CLUBHOUSE.md), never in public/. Served
 * only by /api/vip/files/<id>, and only to a member who may open a lesson or
 * Library item that references the file (admins always).
 *
 * The type is decided by the file's CONTENT (magic bytes), not its name or
 * the browser's claim; anything else is refused.
 */

export const MAX_DOC_BYTES = 25 * 1024 * 1024

const KINDS = [
  { ext: 'pdf', mime: 'application/pdf', test: (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { ext: 'png', mime: 'image/png', test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', mime: 'image/jpeg', test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'mp3', mime: 'audio/mpeg', test: (b: Buffer) => b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  {
    ext: 'm4a',
    mime: 'audio/mp4',
    test: (b: Buffer) => b.subarray(4, 8).toString('latin1') === 'ftyp' && /^(M4A |M4B )/.test(b.subarray(8, 12).toString('latin1')),
  },
  { ext: 'mp4', mime: 'video/mp4', test: (b: Buffer) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
] as const

export function sniffKind(buf: Buffer): (typeof KINDS)[number] | null {
  return KINDS.find((k) => k.test(buf)) ?? null
}

const KEY_RE = /^[0-9a-f-]{36}\.(pdf|png|jpg|mp3|m4a|mp4)$/

function docPath(key: string): string {
  return path.join(process.cwd(), 'private-uploads', 'vip-docs', key)
}

export function cleanFileName(name: string, ext: string): string {
  const base = name
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .normalize('NFKD')
    .replace(/[^\w .()-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
  return `${base || 'download'}.${ext}`
}

export async function saveAdminFile(
  input: Buffer,
  originalName: string,
  uploadedById: string,
): Promise<{ ok: true; file: { id: string; fileName: string; sizeBytes: number; mimeType: string } } | { ok: false; error: string; status: number }> {
  if (input.length === 0) return { ok: false, error: 'The file is empty.', status: 400 }
  if (input.length > MAX_DOC_BYTES) return { ok: false, error: 'File is too large (max 25MB).', status: 413 }
  const kind = sniffKind(input)
  if (!kind) return { ok: false, error: 'Upload a PDF, PNG, JPEG, MP3, M4A or MP4 file.', status: 415 }
  const storageKey = `${randomUUID()}.${kind.ext}`
  await mkdir(path.dirname(docPath(storageKey)), { recursive: true })
  await writeFile(docPath(storageKey), input)
  const row = await prisma.vipFile.create({
    data: { storageKey, fileName: cleanFileName(originalName, kind.ext), mimeType: kind.mime, sizeBytes: input.length, uploadedById },
    select: { id: true, fileName: true, sizeBytes: true, mimeType: true },
  })
  return { ok: true, file: row }
}

export async function readAdminFile(storageKey: string): Promise<Buffer | null> {
  if (!KEY_RE.test(storageKey)) return null
  try {
    return await readFile(docPath(storageKey))
  } catch {
    return null
  }
}

/** May this member download the file? (Referenced by something they can open.) */
export async function canReadFile(
  fileId: string,
  viewer: { userId: string; accessTier: MembershipTier; isAdmin: boolean },
): Promise<boolean> {
  if (viewer.isAdmin) return true
  const file = await prisma.vipFile.findUnique({
    where: { id: fileId },
    select: {
      resources: { select: { published: true, minTier: true } },
      lessonResources: {
        select: {
          lesson: { select: { published: true, minTier: true, module: { select: { course: { select: { id: true, published: true, minTier: true, purchaseOnly: true } } } } } },
        },
      },
    },
  })
  if (!file) return false
  if (file.resources.some((r) => r.published && tierAllows(viewer.accessTier, r.minTier))) return true
  const lessons = file.lessonResources.map((r) => r.lesson).filter((l) => l.published && l.module.course.published)
  if (lessons.length === 0) return false
  const granted = await grantedCourseIds(viewer.userId, lessons.map((l) => l.module.course.id))
  return lessons.some((l) =>
    allowsTier(l.module.course, l.minTier ?? l.module.course.minTier, viewer.accessTier, { granted: granted.has(l.module.course.id) }),
  )
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
