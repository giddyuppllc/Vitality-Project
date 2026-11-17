import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Exercise library. Muscle groups and equipment are short free-text tags,
 * normalised to Title Case so filters match however a coach typed them.
 * Exercises are available to every member (programs carry the tier gating).
 */

export function normaliseTag(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40)
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

export function normaliseTags(list: string[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of list) {
    const t = normaliseTag(raw)
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
  }
  return [...seen.values()].slice(0, 12)
}

export interface ExerciseFilter {
  q?: string
  muscle?: string
  equipment?: string
}

export async function listExercises(filter: ExerciseFilter = {}, take = 300) {
  const where: Prisma.VipExerciseWhereInput = { published: true }
  const q = filter.q?.trim().slice(0, 80)
  if (q) where.name = { contains: q, mode: 'insensitive' }
  if (filter.muscle) where.muscleGroups = { has: normaliseTag(filter.muscle) }
  if (filter.equipment) where.equipment = { has: normaliseTag(filter.equipment) }
  return prisma.vipExercise.findMany({
    where,
    orderBy: { name: 'asc' },
    take,
    select: { id: true, slug: true, name: true, muscleGroups: true, equipment: true, measure: true, imageUrl: true, videoUrl: true },
  })
}

/** Filter chips: every muscle group / equipment tag in use by a published exercise. */
export async function exerciseFacets() {
  const rows = await prisma.vipExercise.findMany({ where: { published: true }, select: { muscleGroups: true, equipment: true } })
  const muscles = new Set<string>()
  const equipment = new Set<string>()
  for (const r of rows) {
    r.muscleGroups.forEach((m) => muscles.add(m))
    r.equipment.forEach((e) => equipment.add(e))
  }
  return { muscles: [...muscles].sort(), equipment: [...equipment].sort() }
}

export async function getExercise(slug: string) {
  const ex = await prisma.vipExercise.findUnique({ where: { slug } })
  return ex && ex.published ? ex : null
}
