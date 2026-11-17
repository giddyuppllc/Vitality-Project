import type { MembershipTier, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from './access'

/**
 * The Library: searchable evergreen reference — guides, PDFs, past session
 * recordings and explainer links. Tier-gated per item; items above the
 * member's tier are listed (title + level) without their link.
 */

export const LIBRARY_CATEGORIES = [
  { key: 'GUIDES', label: 'Guides' },
  { key: 'RESEARCH_LITERACY', label: 'Research literacy' },
  { key: 'COA', label: 'Reading a CoA' },
  { key: 'RECORDINGS', label: 'Session recordings' },
  { key: 'TRAINING', label: 'Training' },
  { key: 'NUTRITION', label: 'Nutrition' },
  { key: 'RECOVERY', label: 'Sleep & recovery' },
  { key: 'LIFESTYLE', label: 'Lifestyle' },
] as const

export const LIBRARY_CATEGORY_KEYS = LIBRARY_CATEGORIES.map((c) => c.key) as unknown as readonly [string, ...string[]]
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number]['key']

export const LIBRARY_KINDS = ['GUIDE', 'PDF', 'RECORDING', 'LINK'] as const
export const LIBRARY_KIND_LABEL: Record<(typeof LIBRARY_KINDS)[number], string> = {
  GUIDE: 'Guide',
  PDF: 'PDF',
  RECORDING: 'Recording',
  LINK: 'Link',
}

export function categoryLabel(key: string): string {
  return LIBRARY_CATEGORIES.find((c) => c.key === key)?.label ?? key
}

export function kindLabel(kind: string): string {
  return LIBRARY_KIND_LABEL[kind as keyof typeof LIBRARY_KIND_LABEL] ?? kind
}

export interface LibraryItem {
  id: string
  title: string
  summary: string | null
  category: string
  kind: string
  minTier: MembershipTier
  allowed: boolean
  href: string | null
  external: boolean
  fileName: string | null
  sizeBytes: number | null
  createdAt: string
  fromEvent: boolean
}

export async function searchLibrary(args: { accessTier: MembershipTier; q?: string | null; category?: string | null; take?: number }) {
  const q = (args.q || '').trim().slice(0, 100)
  const where: Prisma.VipResourceWhereInput = {
    published: true,
    ...(args.category && LIBRARY_CATEGORIES.some((c) => c.key === args.category) ? { category: args.category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { summary: { contains: q, mode: 'insensitive' } },
            { file: { fileName: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }
  const [rows, counts] = await Promise.all([
    prisma.vipResource.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: Math.min(args.take ?? 60, 200),
      include: { file: { select: { id: true, fileName: true, sizeBytes: true } } },
    }),
    prisma.vipResource.groupBy({ by: ['category'], where: { published: true }, _count: { _all: true } }),
  ])
  const items: LibraryItem[] = rows.map((r) => {
    const allowed = tierAllows(args.accessTier, r.minTier)
    const href = !allowed ? null : r.file ? `/api/vip/files/${r.file.id}` : r.url
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      category: r.category,
      kind: r.kind,
      minTier: r.minTier,
      allowed,
      href,
      external: !r.file && !!r.url,
      fileName: r.file?.fileName ?? null,
      sizeBytes: r.file?.sizeBytes ?? null,
      createdAt: r.createdAt.toISOString(),
      fromEvent: !!r.eventId,
    }
  })
  return { items, counts: Object.fromEntries(counts.map((c) => [c.category, c._count._all])) as Record<string, number> }
}
