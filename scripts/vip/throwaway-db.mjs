// Throwaway Postgres for VIP clubhouse dev + tests.
//
// Starts an in-process PGlite (real Postgres compiled to WASM) behind a
// Postgres wire-protocol socket on 127.0.0.1, so the normal Prisma client can
// talk to it through a plain DATABASE_URL. NEVER points at a URL from any .env
// file — the URL is always built here, for 127.0.0.1.
//
// Usage (library):
//   const db = await startThrowawayDb({ dataDir })   // dataDir optional (memory if omitted)
//   db.url            → postgresql://postgres:postgres@127.0.0.1:<port>/postgres?...
//   await db.exec(sql) → run raw SQL directly on PGlite
//   await db.stop()
//
// Usage (CLI, keeps running until Ctrl-C — for `next dev`):
//   node scripts/vip/throwaway-db.mjs --port 54329 --data .vip-dev-db

import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export async function startThrowawayDb({ port = 0, dataDir } = {}) {
  const db = dataDir ? await PGlite.create(dataDir) : await PGlite.create()
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 })
  await server.start()
  const addr = server.server?.address?.() ?? null
  const actualPort = typeof addr === 'object' && addr ? addr.port : port
  const url = `postgresql://postgres:postgres@127.0.0.1:${actualPort}/postgres?sslmode=disable&pgbouncer=true&connection_limit=1&pool_timeout=60`
  return {
    url,
    port: actualPort,
    exec: (sql) => db.exec(sql),
    query: (sql, params) => db.query(sql, params),
    async stop() {
      await server.stop()
      await db.close()
    },
  }
}

/**
 * Run a CLI asynchronously. MUST be async: the PGlite server lives in this
 * process, so a spawnSync would block the event loop and the child could
 * never connect.
 */
export function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, shell: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

/** `prisma db push` a schema file into the throwaway DB. */
export async function pushSchema(url, schemaPath) {
  const r = await run(
    'npx',
    ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss', `"--schema=${schemaPath}"`],
    { DATABASE_URL: url },
  )
  if (r.status !== 0) {
    throw new Error(`prisma db push failed (${r.status}):
${r.stdout}
${r.stderr}`)
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const arg = (name, def) => {
    const i = process.argv.indexOf(name)
    return i >= 0 ? process.argv[i + 1] : def
  }
  const port = Number(arg('--port', '54329'))
  const dataDir = arg('--data', undefined)
  const db = await startThrowawayDb({ port, dataDir })
  console.log(`[throwaway-db] listening — DATABASE_URL="${db.url}"`)
  const shutdown = async () => {
    await db.stop().catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
