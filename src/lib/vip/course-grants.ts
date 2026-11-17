import { prisma } from '@/lib/prisma'
import type { Tx } from './points'

/**
 * THE VipCourseGrant module — the one place grants are read and written
 * (rewards' TRAINING items, academy's points/Zelle purchases, admin grants).
 * Access itself is decided in lib/vip/classroom.ts via academy.allowsTier().
 *
 * Course access outside the tier rule. A member may open a classroom course
 * when their tier allows it OR a VipCourseGrant exists for (member, course) —
 * lib/vip/classroom.ts honours both. Grants come from TRAINING rewards
 * (source "reward:<redemptionId>") and anything else that calls this hook.
 *
 * Idempotent: a second grant for the same member + course is a no-op and the
 * original source is kept.
 */
export async function grantTrainingAccess(
  userId: string,
  courseId: string,
  source = 'admin',
  tx?: Tx,
): Promise<{ id: string; created: boolean }> {
  const db = tx ?? prisma
  const existing = await db.vipCourseGrant.findUnique({ where: { userId_courseId: { userId, courseId } } })
  if (existing) return { id: existing.id, created: false }
  const rows = await db.$queryRaw<{ id: string }[]>`
    INSERT INTO vip_course_grants (id, "userId", "courseId", source, "createdAt")
    VALUES (${`cg_${crypto.randomUUID()}`}, ${userId}, ${courseId}, ${source}, now())
    ON CONFLICT ("userId", "courseId") DO NOTHING
    RETURNING id`
  if (rows.length) return { id: rows[0].id, created: true }
  const row = await db.vipCourseGrant.findUniqueOrThrow({ where: { userId_courseId: { userId, courseId } } })
  return { id: row.id, created: false }
}

/** Remove a grant that came from `source` (e.g. a cancelled TRAINING reward). Other grants stay. */
export async function revokeTrainingAccess(userId: string, courseId: string, source: string, tx?: Tx): Promise<boolean> {
  const { count } = await (tx ?? prisma).vipCourseGrant.deleteMany({ where: { userId, courseId, source } })
  return count > 0
}

/** Course ids this member holds a grant for (optionally limited to `courseIds`). */
export async function grantedCourseIds(userId: string, courseIds?: string[]): Promise<Set<string>> {
  const rows = await prisma.vipCourseGrant.findMany({
    where: { userId, ...(courseIds ? { courseId: { in: courseIds } } : {}) },
    select: { courseId: true },
  })
  return new Set(rows.map((r) => r.courseId))
}

/** @deprecated alias of grantedCourseIds (rewards' original name). */
export const courseGrantSet = (userId: string) => grantedCourseIds(userId)

export async function hasCourseGrant(userId: string, courseId: string): Promise<boolean> {
  return !!(await prisma.vipCourseGrant.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true } }))
}
