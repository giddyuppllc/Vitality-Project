import { prisma } from '@/lib/prisma'
import type { CourseCard } from './classroom'

/** Learning paths (VipTrack): an ordered set of courses. */

export const TRACK_CATEGORIES = [
  { key: 'FOUNDATIONS', label: 'Foundations' },
  { key: 'RESEARCH', label: 'Research' },
  { key: 'HEALTH', label: 'Health' },
  { key: 'FITNESS', label: 'Fitness' },
  { key: 'LIFESTYLE', label: 'Lifestyle' },
] as const

export function trackCategoryLabel(key: string): string {
  return TRACK_CATEGORIES.find((c) => c.key === key)?.label ?? key
}

export interface TrackView {
  id: string
  slug: string
  title: string
  summary: string | null
  category: string
  courses: CourseCard[]
  lessonCount: number
  completedCount: number
  openCount: number
  certificates: number
}

/**
 * Published learning paths with the member's view of their courses. A path
 * with no published course is not shown at all.
 */
export async function listTracks(courses: CourseCard[]): Promise<TrackView[]> {
  const tracks = await prisma.vipTrack.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return tracks
    .map((t) => {
      const own = courses.filter((c) => c.track?.id === t.id)
      return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        summary: t.summary,
        category: t.category,
        courses: own,
        lessonCount: own.reduce((n, c) => n + c.lessonCount, 0),
        completedCount: own.reduce((n, c) => n + (c.allowed ? c.completedCount : 0), 0),
        openCount: own.filter((c) => c.allowed).length,
        certificates: own.filter((c) => c.certificateCode).length,
      }
    })
    .filter((t) => t.courses.length > 0)
}
