import { defineConfig } from 'vitest/config'
import path from 'node:path'

// VIP clubhouse test suite. Runs against a throwaway in-process Postgres
// (PGlite, see scripts/vip/throwaway-db.mjs) — never a database from .env.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    // One shared throwaway DB → run files one at a time.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
