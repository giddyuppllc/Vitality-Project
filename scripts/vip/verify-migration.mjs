// Proves the clubhouse migrations are (a) additive, (b) idempotent,
// (c) exactly equal to schema.prisma, and (d) that the deploy's own
// `prisma db push --skip-generate` (NO --accept-data-loss) goes through on a
// production-shaped database that already holds rows.
//
//   A. SQL path
//      1. throwaway PGlite DB ← `prisma db push` of origin/master's schema
//         (i.e. what production has today)
//      2. apply 001_vip_clubhouse.sql and 002_vip_platform.sql, each TWICE
//         (the second run must succeed and change nothing)
//      3. `prisma migrate diff --from-url <db> --to-schema-datamodel
//         schema.prisma --exit-code` must report NO difference
//   B. push path (what .github/workflows/deploy.yml runs)
//      1. a second throwaway DB ← origin/master's schema
//      2. rows in existing tables: users, memberships, vip_profiles,
//         vip_posts, vip_reports, loyalty_accounts, loyalty_transactions
//      3. `prisma db push --skip-generate` of schema.prisma WITHOUT
//         --accept-data-loss must exit 0 (no warning, no prompt), every row
//         must still be there, and migrate diff must be empty
//
// Never touches any database but the in-process throwaway ones.
//
//   npm run verify:vip-migration

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startThrowawayDb, pushSchema, run } from './throwaway-db.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const sqlFiles = ['001_vip_clubhouse.sql', '002_vip_platform.sql'].map((f) => path.join(root, 'prisma', 'migrations-manual', f))
const schemaPath = path.join(root, 'prisma', 'schema.prisma')
const baseRef = process.env.VIP_MIGRATION_BASE_REF || 'origin/master'

const tmp = mkdtempSync(path.join(tmpdir(), 'vip-mig-'))
const baseSchema = path.join(tmp, 'base.prisma')
writeFileSync(baseSchema, execSync(`git show ${baseRef}:prisma/schema.prisma`, { cwd: root }))

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`✗ ${msg}`)
}

async function diffIsEmpty(url, label) {
  const r = await run(
    'npx',
    ['prisma', 'migrate', 'diff', '--from-url', `"${url}"`, '--to-schema-datamodel', `"${schemaPath}"`, '--exit-code', '--script'],
    { DATABASE_URL: url },
  )
  if (r.status === 0) console.log(`✓ ${label}: database == schema.prisma (prisma migrate diff: empty)`)
  else fail(`${label}: migrate diff exit ${r.status} — database and schema.prisma disagree:\n${r.stdout}\n${r.stderr}`)
}

// Additive check, statement by statement: nothing may drop or rewrite an
// existing object. On tables that already exist (anything not created in the
// same file) only ADD COLUMN IF NOT EXISTS (nullable or with a default) and
// ADD CONSTRAINT are allowed.
function additiveProblems(sql, file) {
  const problems = []
  if (/\b(DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)|ALTER\s+COLUMN|RENAME|DELETE\s+FROM|UPDATE\s+"|TRUNCATE)\b/i.test(sql)) {
    problems.push(`${file}: contains DROP / ALTER COLUMN / RENAME / DELETE / UPDATE / TRUNCATE`)
  }
  for (const m of sql.matchAll(/ALTER\s+TABLE\s+"([^"]+)"([\s\S]*?);/gi)) {
    const body = m[2].trim()
    const parts = body.split(/,\s*(?=ADD\s)/i)
    for (const p of parts) {
      const t = p.trim()
      if (/^ADD\s+CONSTRAINT\s+"[^"]+"\s+FOREIGN\s+KEY/i.test(t)) continue
      if (/^ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"[^"]+"/i.test(t)) {
        if (/NOT\s+NULL/i.test(t) && !/DEFAULT/i.test(t)) problems.push(`${file}: "${m[1]}" gains a NOT NULL column without a default: ${t}`)
        continue
      }
      problems.push(`${file}: non-additive ALTER TABLE "${m[1]}": ${t.slice(0, 120)}`)
    }
  }
  return problems
}

// ─── A. SQL path ────────────────────────────────────────────────────────────
{
  const db = await startThrowawayDb()
  try {
    await pushSchema(db.url, baseSchema)
    console.log(`✓ [sql] base schema (${baseRef}) pushed`)
    for (const f of sqlFiles) {
      const sql = readFileSync(f, 'utf8')
      const name = path.basename(f)
      await db.exec(sql)
      console.log(`✓ [sql] ${name} applied (run 1)`)
      await db.exec(sql)
      console.log(`✓ [sql] ${name} applied again (run 2) — idempotent`)
      const problems = additiveProblems(sql, name)
      if (problems.length) problems.forEach(fail)
      else console.log(`✓ [sql] ${name} additive only`)
    }
    await diffIsEmpty(db.url, '[sql] after 001 + 002')
  } catch (err) {
    fail(`[sql] ${err?.stack || err}`)
  } finally {
    await db.stop()
  }
}

// ─── B. push path (the deploy) ──────────────────────────────────────────────
{
  const db = await startThrowawayDb()
  try {
    await pushSchema(db.url, baseSchema)
    console.log(`✓ [push] base schema (${baseRef}) pushed`)
    const now = `now()`
    await db.exec(`
      INSERT INTO users (id, email, "updatedAt") VALUES
        ('zz_mig_u1', 'zz-mig-1@example.invalid', ${now}),
        ('zz_mig_u2', 'zz-mig-2@example.invalid', ${now});
      INSERT INTO memberships (id, "userId", tier, status, "updatedAt") VALUES
        ('zz_mig_m1', 'zz_mig_u1', 'PLUS', 'ACTIVE', ${now});
      INSERT INTO vip_profiles (id, "userId", "displayName", "updatedAt") VALUES
        ('zz_mig_p1', 'zz_mig_u1', 'ZZ Migration', ${now});
      INSERT INTO vip_posts (id, "authorId", body, "updatedAt") VALUES
        ('zz_mig_post1', 'zz_mig_u1', 'zz a post from before the upgrade', ${now});
      INSERT INTO vip_reports (id, "reporterId", "postId", reason) VALUES
        ('zz_mig_r1', 'zz_mig_u2', 'zz_mig_post1', 'zz report');
      INSERT INTO loyalty_accounts (id, "userId", points, "updatedAt") VALUES
        ('zz_mig_la1', 'zz_mig_u1', 1200, ${now}),
        ('zz_mig_la2', 'zz_mig_u2', 40, ${now});
      INSERT INTO loyalty_transactions (id, "accountId", type, points, description) VALUES
        ('zz_mig_lt1', 'zz_mig_la1', 'EARN_PURCHASE', 1000, 'zz'),
        ('zz_mig_lt2', 'zz_mig_la1', 'EARN_PURCHASE', 200, 'zz'),
        ('zz_mig_lt3', 'zz_mig_la2', 'EARN_PURCHASE', 40, 'zz');
    `)
    const counts = async () =>
      Object.fromEntries(
        await Promise.all(
          ['users', 'memberships', 'vip_profiles', 'vip_posts', 'vip_reports', 'loyalty_accounts', 'loyalty_transactions'].map(async (t) => [
            t,
            Number((await db.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n),
          ]),
        ),
      )
    const before = await counts()
    console.log(`✓ [push] rows in existing tables: ${JSON.stringify(before)}`)

    const r = await run('npx', ['prisma', 'db', 'push', '--skip-generate', `"--schema=${schemaPath}"`], { DATABASE_URL: db.url })
    const out = `${r.stdout}\n${r.stderr}`
    if (r.status !== 0) fail(`[push] prisma db push (no --accept-data-loss) exit ${r.status}:\n${out}`)
    else if (/warning|data loss|--accept-data-loss/i.test(out)) fail(`[push] prisma db push printed a warning:\n${out}`)
    else console.log('✓ [push] prisma db push --skip-generate (no --accept-data-loss) → exit 0, no warnings')

    const after = await counts()
    if (JSON.stringify(after) !== JSON.stringify(before)) fail(`[push] row counts changed: ${JSON.stringify(after)}`)
    else console.log('✓ [push] every row still there')
    const lt = (await db.query(`SELECT count(*)::int AS n FROM loyalty_transactions WHERE "idempotencyKey" IS NULL`)).rows[0].n
    if (Number(lt) !== 3) fail(`[push] expected the 3 existing ledger rows with a NULL idempotencyKey, got ${lt}`)
    await diffIsEmpty(db.url, '[push]')
  } catch (err) {
    fail(`[push] ${err?.stack || err}`)
  } finally {
    await db.stop()
  }
}

process.exit(failed ? 1 : 0)
