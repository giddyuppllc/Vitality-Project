import { afterEach, describe, expect, it, vi } from 'vitest'

// The real lib/vip/live.ts (test/setup.ts mocks it for every other file),
// with the public-DNS resolver stubbed.
const dns = vi.hoisted(() => ({ a: [] as string[], aaaa: [] as string[], lookups: 0, servers: [] as string[], emptyAnswers: false }))
vi.mock('node:dns/promises', () => ({
  Resolver: class {
    setServers(s: string[]) {
      dns.servers = s
    }
    async resolve4() {
      dns.lookups++
      if (!dns.a.length && !dns.emptyAnswers) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' })
      return dns.a
    }
    async resolve6() {
      if (!dns.aaaa.length && !dns.emptyAnswers) throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' })
      return dns.aaaa
    }
  },
}))

const load = async () => vi.importActual<typeof import('@/lib/vip/live')>('@/lib/vip/live')

afterEach(async () => {
  ;(await load()).resetVipDomainLive()
  dns.a = []
  dns.aaaa = []
  dns.lookups = 0
  dns.emptyAnswers = false
  delete process.env.VIP_MAIL_REQUIRE_DNS
})

describe('vipDomainLive (clubhouse mail waits for public DNS)', () => {
  it('not live without an A/AAAA answer; re-checks only after 5 minutes; once live, stays live', async () => {
    const { vipDomainLive } = await load()
    const t0 = 1_000_000_000
    expect(await vipDomainLive(t0)).toBe(false)
    expect(dns.servers).toEqual(['1.1.1.1', '8.8.8.8'])
    dns.a = ['104.21.0.1']
    expect(await vipDomainLive(t0 + 60_000)).toBe(false) // cached "not live"
    expect(dns.lookups).toBe(1)
    expect(await vipDomainLive(t0 + 5 * 60_000)).toBe(true)
    dns.a = []
    expect(await vipDomainLive(t0 + 60 * 60_000)).toBe(true) // remembered
    expect(dns.lookups).toBe(2)
  })

  it('an AAAA answer alone counts', async () => {
    const { vipDomainLive } = await load()
    dns.aaaa = ['2606:4700::1']
    expect(await vipDomainLive(1)).toBe(true)
  })

  it('an empty answer is not live', async () => {
    const { vipDomainLive } = await load()
    dns.emptyAnswers = true
    expect(await vipDomainLive(1)).toBe(false)
  })

  it('VIP_MAIL_REQUIRE_DNS=0 skips the check', async () => {
    const { vipDomainLive } = await load()
    process.env.VIP_MAIL_REQUIRE_DNS = '0'
    expect(await vipDomainLive(1)).toBe(true)
    expect(dns.lookups).toBe(0)
  })
})
