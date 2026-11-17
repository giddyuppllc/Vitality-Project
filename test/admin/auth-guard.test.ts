import { beforeAll, describe, expect, it } from 'vitest'
import { makeUser, params, req, setSession } from '../helpers'

/**
 * Every /api/admin/* handler (except the clubhouse's /api/admin/vip, which has
 * its own suite) must refuse an anonymous caller and a signed-in customer
 * BEFORE touching anything. Discovered by glob, so a new admin route is
 * covered the day it is added.
 */
const modules = import.meta.glob('../../src/app/api/admin/**/route.ts')
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const P = { id: 'zz-missing', imageId: 'zz-missing', variantId: 'zz-missing', noteId: 'zz-missing' }

const entries = Object.entries(modules).filter(([file]) => !file.includes('/api/admin/vip/'))

describe('admin API auth guard', () => {
  let customer: { id: string; email: string }
  beforeAll(async () => {
    customer = await makeUser({ tag: 'guard-customer' })
  })

  it('finds the admin routes', () => {
    expect(entries.length).toBeGreaterThan(50)
  })

  for (const [file, load] of entries) {
    const url = file
      .replace('../../src/app', '')
      .replace('/route.ts', '')
      .replace(/\[(\w+)\]/g, 'zz-missing')
    for (const who of ['anonymous', 'customer'] as const) {
      it(`${who} is refused on ${url}`, async () => {
        const mod = (await load()) as Record<string, unknown>
        const handlers = METHODS.filter((m) => typeof mod[m] === 'function')
        expect(handlers.length).toBeGreaterThan(0)
        for (const m of handlers) {
          setSession(who === 'anonymous' ? null : { ...customer, role: 'CUSTOMER' })
          const body =
            m === 'GET' || m === 'DELETE' ? undefined : { role: 'ADMIN', email: 'zz@example.invalid' }
          const handler = mod[m] as (r: unknown, c: unknown) => Promise<Response>
          const res = await handler(req(`http://localhost${url}`, { method: m, body }), params(P))
          expect([401, 403], `${m} ${url} as ${who} -> ${res.status}`).toContain(res.status)
        }
      })
    }
  }
})
