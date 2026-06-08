import { PrismaClient, Prisma } from '@prisma/client'

/**
 * Prisma client with an automatic retry on transient connection drops.
 *
 * Neon's pooled (pgbouncer) endpoint recycles/closes server connections
 * between queries, and Neon compute can autosuspend on idle — so Prisma
 * occasionally throws "Error in PostgreSQL connection: kind: Closed" (P1017)
 * when it reaches for a connection that the proxy already dropped. The query
 * never executed in that case, so retrying is safe for reads AND writes.
 *
 * The retry is centralized here as a client extension so all ~190 call sites
 * get it for free, with no change to how they use `prisma`.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

// Backoff schedule — small, since a dropped pooled connection re-establishes
// almost immediately. Length of this array = number of retries.
const RETRY_DELAYS_MS = [50, 150, 400]

// Prisma codes for "the connection went away before the query ran".
const TRANSIENT_CODES = new Set(['P1017', 'P1001', 'P1008'])

function isTransientConnectionError(err: unknown): boolean {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    TRANSIENT_CODES.has(err.code)
  ) {
    return true
  }
  // The raw Neon/pg "Closed" error can surface as an initialization-style
  // message rather than a typed code — match defensively.
  const msg = String((err as { message?: unknown })?.message ?? '').toLowerCase()
  return (
    msg.includes('kind: closed') ||
    msg.includes('connection closed') ||
    msg.includes('server has closed the connection') ||
    msg.includes("can't reach database server")
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends({
    query: {
      async $allOperations({ args, query }) {
        let lastError: unknown
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
          try {
            return await query(args)
          } catch (err) {
            lastError = err
            if (attempt < RETRY_DELAYS_MS.length && isTransientConnectionError(err)) {
              await sleep(RETRY_DELAYS_MS[attempt])
              continue
            }
            throw err
          }
        }
        throw lastError
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
