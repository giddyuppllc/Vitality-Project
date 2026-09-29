import path from 'node:path'
import { startThrowawayDb, pushSchema } from '../scripts/vip/throwaway-db.mjs'

/**
 * Starts a throwaway Postgres (PGlite over a local socket), pushes the
 * branch's prisma schema into it, and points DATABASE_URL at it for every
 * test worker. Any DATABASE_URL already in the environment is IGNORED and
 * overwritten — tests can never reach a real database.
 */
export default async function setup() {
  const db = await startThrowawayDb()
  await pushSchema(db.url, path.resolve(__dirname, '..', 'prisma', 'schema.prisma'))
  process.env.DATABASE_URL = db.url
  return async () => {
    await db.stop()
  }
}
