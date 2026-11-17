/**
 * OPTIONAL production seed: starter EXERCISES for the clubhouse exercise
 * library (scripts/vip/fitness-starter.ts). REVIEW THAT LIST FIRST — nothing
 * runs automatically, and nothing in the deploy calls this.
 *
 *   npx tsx scripts/seed-vip-fitness.ts --dry-run   # prints the plan, writes nothing
 *   npx tsx scripts/seed-vip-fitness.ts
 *
 * Insert-only and safe to re-run: an exercise whose slug already exists is
 * skipped (never updated or deleted). Creates no programs, challenges,
 * articles, members or activity — those are the coaching team's to write.
 */
import { PrismaClient } from '@prisma/client'
import { seedFitnessExercises } from './vip/seed-fitness-core'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const prisma = new PrismaClient()
  try {
    const r = await seedFitnessExercises(prisma, { dryRun, log: (l) => console.log(`  ${l}`) })
    console.log(`${dryRun ? 'DRY RUN — ' : ''}${r.created.length} to create, ${r.skipped.length} already present.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
