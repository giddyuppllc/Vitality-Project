import { describe, expect, it, afterEach } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { mintSessionToken } from '@/lib/vip/session'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { proxy } from '@/proxy'
import { isVipHost, resolveSite, routeFor } from '@/lib/vip/host'
import { metadata as vipMetadata } from '@/app/vip/layout'

const isAdminPath = (p: string) => p === '/admin' || p.startsWith('/admin/')

/** Synchronous for every path except .global /admin pages (see the admin guard tests). */
function call(host: string, pathname: string, cookie?: string): NextResponse {
  const headers: Record<string, string> = { host }
  if (cookie) headers.cookie = cookie
  const res = proxy(new NextRequest(new URL(pathname, `http://${host}`), { headers }))
  if (res instanceof Promise) throw new Error(`async proxy result for ${host}${pathname}`)
  return res
}

async function callAsync(host: string, pathname: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(new URL(pathname, `http://${host}`), { headers: { host, ...headers } }))
}

const isPassthrough = (res: Response) =>
  res.headers.get('x-middleware-next') === '1' && !res.headers.get('x-middleware-rewrite')
const rewriteTarget = (res: Response) => {
  const r = res.headers.get('x-middleware-rewrite')
  return r ? new URL(r).pathname : null
}

// Every top-level route segment of the existing .global app, read from disk
// so a new store route is covered automatically.
const appDir = path.resolve(__dirname, '../../src/app')
const globalTopLevel = readdirSync(appDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'vip')
  .map((d) => d.name)
// plus the store's own top-level pages inside the (store) group
const storeTopLevel = readdirSync(path.join(appDir, '(store)'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

describe('host routing — .global is untouched', () => {
  const hosts = ['vitalityproject.global', 'www.vitalityproject.global', 'localhost:3000', 'some-tenant.vitalityproject.global']

  it('found the existing store route segments', () => {
    expect(globalTopLevel).toEqual(expect.arrayContaining(['(store)', 'admin', 'api', 'auth', 'clubhouse']))
    expect(storeTopLevel).toEqual(expect.arrayContaining(['shop', 'products', 'membership', 'account', 'checkout']))
  })

  for (const host of hosts) {
    it(`passes every existing path straight through on ${host}`, () => {
      const paths = [
        '/', '/shop', '/products/x', '/membership', '/account/credits', '/checkout', '/auth/login',
        '/admin', '/admin/vip', '/admin/members', '/clubhouse', '/api/checkout', '/api/checkout-zelle',
        '/api/auth/session', '/api/admin/vip/moderation', '/api/cron/vip-member-rewards',
        '/robots.txt', '/sitemap.xml', '/service-worker.js', '/manifest.json', '/logo.png', '/uploads/2026-01/a.jpg',
        '/feed', '/members', // paths that exist on .vip must NOT be rewritten on .global
        ...[...globalTopLevel, ...storeTopLevel]
          .filter((s) => !s.startsWith('(') && !s.startsWith('[') && !s.includes('.'))
          .map((s) => `/${s}`),
      ]
      for (const p of paths) {
        if (isAdminPath(p)) continue // covered by the admin guard tests below
        const res = call(host, p)
        expect(isPassthrough(res), `${host}${p}`).toBe(true)
        expect(res.headers.get('x-robots-tag'), `${host}${p}`).toBeNull()
        expect(res.headers.get('set-cookie'), `${host}${p}`).toBeNull()
        // request headers untouched (no x-middleware-request-* overrides)
        expect(res.headers.get('x-middleware-override-headers'), `${host}${p}`).toBeNull()
      }
    })
  }

  it('hides the clubhouse internals on .global (404)', () => {
    for (const p of ['/vip', '/vip/feed', '/api/vip/posts', '/api/sso']) {
      const res = call('vitalityproject.global', p)
      expect(isPassthrough(res), p).toBe(false)
      if (p.startsWith('/api/')) expect(res.status, p).toBe(404)
      else expect(rewriteTarget(res), p).toBe('/__not-found')
    }
  })
})

describe('.global /admin pages are guarded in the proxy (not only by the layout)', () => {
  const host = 'vitalityproject.global'
  const adminPages = ['/admin', '/admin/customers', '/admin/members', '/admin/vip', '/admin/vip/members', '/admin/orders/abc']
  const rscHeaders = {
    RSC: '1',
    'Next-Router-State-Tree': encodeURIComponent(JSON.stringify(['', { children: ['admin', { children: ['__PAGE__', {}] }] }])),
  }
  const session = async (role: string) =>
    `${SESSION_COOKIE_NAME}=${await mintSessionToken({ id: `zz-${role}`, email: `zz-${role}@example.invalid`, name: null, role })}`

  it('anonymous and non-admin sessions are sent to /auth/login, even with a crafted RSC request', async () => {
    const member = await session('CUSTOMER')
    for (const p of adminPages) {
      for (const headers of [{} as Record<string, string>, rscHeaders, { cookie: member }, { cookie: member, ...rscHeaders }, { cookie: `${SESSION_COOKIE_NAME}=forged` }]) {
        const res = await callAsync(host, p, headers)
        expect(res.status, `${p} ${JSON.stringify(headers).slice(0, 40)}`).toBe(307)
        expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/login')
      }
    }
  })

  it('an admin session passes straight through, untouched', async () => {
    const admin = await session('ADMIN')
    for (const p of adminPages) {
      const res = await callAsync(host, p, { cookie: admin, ...rscHeaders })
      expect(isPassthrough(res), p).toBe(true)
      expect(res.headers.get('x-middleware-override-headers'), p).toBeNull()
    }
  })

  it('leaves /api/admin (handlers check for themselves) and look-alike paths synchronous', () => {
    for (const p of ['/api/admin/vip/moderation', '/administrator', '/admins']) {
      expect(isPassthrough(call(host, p)), p).toBe(true)
    }
  })
})

describe('host routing — .vip serves the clubhouse', () => {
  const hosts = ['vitalityproject.vip', 'www.vitalityproject.vip', 'VitalityProject.VIP:443']

  for (const host of hosts) {
    it(`rewrites pages into /vip on ${host}`, () => {
      expect(rewriteTarget(call(host, '/'))).toBe('/vip')
      expect(rewriteTarget(call(host, '/feed'))).toBe('/vip/feed')
      expect(rewriteTarget(call(host, '/posts/abc'))).toBe('/vip/posts/abc')
      expect(rewriteTarget(call(host, '/robots.txt'))).toBe('/vip/robots.txt')
      // store pages don't exist here → clubhouse 404 via the catch-all
      expect(rewriteTarget(call(host, '/shop'))).toBe('/vip/shop')
      expect(rewriteTarget(call(host, '/admin'))).toBe('/vip/admin')
    })
  }

  it('flags clubhouse requests for the root layout, and strips a spoofed flag on .global', () => {
    for (const p of ['/', '/feed', '/api/vip/posts', '/does-not-exist']) {
      expect(call('vitalityproject.vip', p).headers.get('x-middleware-request-x-vp-site'), p).toBe('vip')
    }
    const spoofed = (proxy(
      new NextRequest(new URL('/', 'http://vitalityproject.global'), {
        headers: { host: 'vitalityproject.global', 'x-vp-site': 'vip' },
      }),
    ) as NextResponse)
    expect(spoofed.headers.get('x-middleware-override-headers') ?? '').not.toContain('x-vp-site=')
    expect(spoofed.headers.get('x-middleware-request-x-vp-site')).toBeNull()
    expect(spoofed.headers.get('x-middleware-override-headers')).not.toBeNull() // header list rewritten without it
  })

  it('sends noindex on every clubhouse response', () => {
    for (const p of ['/', '/feed', '/api/vip/posts', '/api/sso', '/robots.txt', '/logo.png', '/_next/data/x.json']) {
      expect(call('vitalityproject.vip', p).headers.get('x-robots-tag'), p).toContain('noindex')
    }
  })

  it('only the clubhouse + auth APIs answer on .vip; store APIs are 404', () => {
    for (const p of ['/api/vip/posts', '/api/vip/auth/login', '/api/auth/session', '/api/sso']) {
      expect(isPassthrough(call('vitalityproject.vip', p)), p).toBe(true)
    }
    for (const p of ['/api/checkout', '/api/checkout-zelle', '/api/products', '/api/admin/vip/moderation', '/api/cron/vip-member-rewards']) {
      const res = call('vitalityproject.vip', p)
      expect(res.status, p).toBe(404)
    }
  })

  it("never serves the store's PWA files on .vip", () => {
    for (const p of ['/service-worker.js', '/manifest.json', '/sitemap.xml']) {
      expect(rewriteTarget(call('vitalityproject.vip', p)), p).toBe('/vip/__not-found')
    }
  })

  it('clubhouse metadata is noindex/nofollow with no store manifest', () => {
    const robots = vipMetadata.robots as { index: boolean; follow: boolean }
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
    expect(vipMetadata.manifest).toBeNull()
  })
})

describe('VIP_HOST config + dev override', () => {
  const origEnv = process.env.NODE_ENV
  afterEach(() => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = origEnv
  })

  it('VIP_HOST is configurable (comma list, www added)', () => {
    const env = { VIP_HOST: 'club.example.test, other.example.test' }
    expect(isVipHost('club.example.test', env)).toBe(true)
    expect(isVipHost('www.club.example.test', env)).toBe(true)
    expect(isVipHost('other.example.test:8080', env)).toBe(true)
    expect(isVipHost('vitalityproject.vip', env)).toBe(false)
  })

  it('?__host=vip / cookie pins the clubhouse on localhost in dev only', () => {
    const dev = { NODE_ENV: 'development', VIP_HOST: 'vitalityproject.vip' }
    const prod = { NODE_ENV: 'production', VIP_HOST: 'vitalityproject.vip' }
    expect(resolveSite({ host: 'localhost:3000', devParam: 'vip', env: dev })).toBe('vip')
    expect(resolveSite({ host: 'localhost:3000', devCookie: 'vip', env: dev })).toBe('vip')
    expect(resolveSite({ host: 'localhost:3000', devCookie: 'vip', devParam: 'global', env: dev })).toBe('global')
    expect(resolveSite({ host: 'vitalityproject.global', devParam: 'vip', env: prod })).toBe('global')
    expect(resolveSite({ host: 'vitalityproject.global', devCookie: 'vip', env: prod })).toBe('global')
  })

  it('proxy sets / clears the dev cookie, and ignores it in production', () => {
    ;(process.env as Record<string, string>).NODE_ENV = 'development'
    const pin = call('localhost:3000', '/feed?__host=vip')
    expect(rewriteTarget(pin)).toBe('/vip/feed')
    expect(pin.headers.get('set-cookie')).toContain('vp_dev_site=vip')
    expect(rewriteTarget(call('localhost:3000', '/feed', 'vp_dev_site=vip'))).toBe('/vip/feed')

    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    const res = call('vitalityproject.global', '/feed?__host=vip', 'vp_dev_site=vip')
    expect(isPassthrough(res)).toBe(true)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('routeFor is a pure function of site + path', () => {
    expect(routeFor('global', '/feed')).toEqual({ kind: 'next' })
    expect(routeFor('vip', '/feed')).toEqual({ kind: 'rewrite', path: '/vip/feed' })
  })
})
