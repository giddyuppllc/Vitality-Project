// Proves prisma/migrations-manual/001_vip_clubhouse.sql is (a) additive,
// (b) idempotent and (c) exactly equal to the Vip* models in schema.prisma.
//
//   1. throwaway PGlite DB ← `prisma db push` of origin/master's schema
//      (i.e. what production has today)
//   2. apply the SQL file TWICE (second run must succeed and change nothing)
//   3. `prisma migrate diff --from-url <db> --to-schema-datamodel schema.prisma
//      --exit-code` must report NO difference (exit 0).
//
// Never touches any database but the in-process throwaway one.
//
//   npm run verify:vip-migration

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startThrowawayDb, pushSchema, run } from './throwaway-db.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const sqlPath = path.join(root, 'prisma', 'migrations-manual', '001_vip_clubhouse.sql')
const schemaPath = path.join(root, 'prisma', 'schema.prisma')
const baseRef = process.env.VIP_MIGRATION_BASE_REF || 'origin/master'

const tmp = mkdtempSync(path.join(tmpdir(), 'vip-mig-'))
const baseSchema = path.join(tmp, 'base.prisma')
writeFileSync(baseSchema, execSync(`git show ${baseRef}:prisma/schema.prisma`, { cwd: root }))

let failed = false
const db = await startThrowawayDb()
try {
  await pushSchema(db.url, baseSchema)
  console.log(`✓ base schema (${baseRef}) pushed`)

  const sql = readFileSync(sqlPath, 'utf8')
  await db.exec(sql)
  console.log('✓ migration applied (run 1)')
  await db.exec(sql)
  console.log('✓ migration applied again (run 2) — idempotent')

  const r = await run(
    'npx',
    ['prisma', 'migrate', 'diff', '--from-url', `"${db.url}"`, '--to-schema-datamodel', `"${schemaPath}"`, '--exit-code', '--script'],
    { DATABASE_URL: db.url },
  )
  if (r.status === 0) {
    console.log('✓ database == schema.prisma (prisma migrate diff: empty)')
  } else {
    failed = true
    console.error(`✗ migrate diff exit ${r.status} — SQL and schema.prisma disagree:\n${r.stdout}\n${r.stderr}`)
  }

  // Additive check: the SQL may not drop/alter existing objects.
  const forbidden = /\b(DROP\s+(TABLE|COLUMN|TYPE|INDEX)|ALTER\s+TABLE\s+"(?!vip_)[^"]+"|ALTER\s+COLUMN|DELETE\s+FROM|UPDATE\s+"|TRUNCATE)\b/i
  if (forbidden.test(sql)) {
    failed = true
    console.error('✗ migration contains a non-additive statement')
  } else {
    console.log('✓ additive only (no DROP / ALTER of existing tables / UPDATE / DELETE)')
  }
} catch (err) {
  failed = true
  console.error('✗', err)
} finally {
  await db.stop()
}
process.exit(failed ? 1 : 0)
