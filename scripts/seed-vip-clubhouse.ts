/**
 * Production starter content for vitalityproject.vip — run BY HAND once at
 * deploy (docs/VIP_CLUBHOUSE.md → Deploy runbook). Insert-only and safe to
 * re-run: existing rows are never updated or deleted (scripts/vip/seed-core.ts).
 *
 *   VIP_SEED_AUTHOR_EMAIL=<an ADMIN account's email> \
 *     npx tsx scripts/seed-vip-clubhouse.ts --dry-run     # prints the plan, writes nothing
 *   VIP_SEED_AUTHOR_EMAIL=<…> npx tsx scripts/seed-vip-clubhouse.ts
 *
 * Creates: 8 spaces, the pinned welcome + guidelines posts (authored by that
 * admin, shown as "Vitality Team" if the admin has no clubhouse profile yet),
 * 3 courses (Orientation / Foundations / 12-Week Reset), 3 monthly event
 * series and the default reward amounts. No members, no member posts.
 */
import { PrismaClient } from '@prisma/client'
import { seedClubhouse } from './vip/seed-core'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const prisma = new PrismaClient()
  try {
    const tzRow = await prisma.siteSetting.findUnique({ where: { key: 'vip.timeZone' } })
    const report = await seedClubhouse(prisma, {
      authorEmail: process.env.VIP_SEED_AUTHOR_EMAIL || null,
      dryRun,
      timeZone: tzRow?.value?.trim() || 'America/New_York',
      log: (l) => console.log(`  ${l}`),
    })
    for (const w of report.warnings) console.warn(`  ! ${w}`)
    console.log(`${dryRun ? 'DRY RUN — ' : ''}${report.created.length} to create, ${report.skipped.length} already present.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
