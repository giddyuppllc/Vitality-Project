import type { PrismaClient } from '@prisma/client'
import { STARTER_EXERCISES } from './fitness-starter'

/**
 * Insert-only starter exercises. An exercise whose slug already exists is
 * SKIPPED — never updated, never deleted — so a coach's edits always win and
 * re-running changes nothing. `dryRun` writes nothing.
 */
export async function seedFitnessExercises(
  db: PrismaClient,
  opts: { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<{ created: string[]; skipped: string[] }> {
  const log = opts.log ?? (() => {})
  const created: string[] = []
  const skipped: string[] = []
  for (const e of STARTER_EXERCISES) {
    const existing = await db.vipExercise.findUnique({ where: { slug: e.slug }, select: { id: true } })
    if (existing) {
      skipped.push(e.slug)
      log(`skip   exercise ${e.slug} (already present)`)
      continue
    }
    created.push(e.slug)
    log(`${opts.dryRun ? 'would create' : 'create'} exercise ${e.slug}`)
    if (!opts.dryRun) {
      await db.vipExercise.create({
        data: { slug: e.slug, name: e.name, muscleGroups: e.muscleGroups, equipment: e.equipment, measure: e.measure, instructions: e.instructions, published: true },
      })
    }
  }
  return { created, skipped }
}
