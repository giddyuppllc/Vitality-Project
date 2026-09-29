/**
 * Host-based routing between the two front-ends served by this ONE app:
 *
 *   vitalityproject.global (and every other host) → the existing store, untouched
 *   vitalityproject.vip / www.vitalityproject.vip → the members' clubhouse,
 *                                                   rewritten into src/app/vip
 *
 * Pure functions only (no Next imports) so src/proxy.ts and the tests share
 * exactly the same decision logic.
 */

/** Internal path prefix the clubhouse pages live under (src/app/vip). */
export const VIP_PREFIX = '/vip'

/** Dev-only override: `?__host=vip` sets this cookie, `?__host=global` clears it. */
export const DEV_SITE_COOKIE = 'vp_dev_site'
export const DEV_HOST_PARAM = '__host'

/** Request header src/proxy.ts sets to 'vip' on clubhouse requests (and strips
 *  from every other request, so a client cannot spoof it). Read by the root layout. */
export const SITE_HEADER = 'x-vp-site'

export type Site = 'vip' | 'global'

/** Configured .vip host(s). VIP_HOST may be a comma-separated list. */
export function vipHosts(env: Record<string, string | undefined> = process.env): string[] {
  const raw = (env.VIP_HOST || 'vitalityproject.vip').trim()
  const hosts = new Set<string>()
  for (const h of raw.split(',')) {
    const host = h.trim().toLowerCase()
    if (!host) continue
    hosts.add(host)
    if (!host.startsWith('www.')) hosts.add(`www.${host}`)
  }
  return [...hosts]
}

/** Strip port + lowercase. */
export function normalizeHost(host: string | null | undefined): string {
  return (host || '').trim().toLowerCase().replace(/:\d+$/, '')
}

export function isVipHost(
  host: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const h = normalizeHost(host)
  return !!h && vipHosts(env).includes(h)
}

export interface SiteInput {
  host: string | null | undefined
  /** Value of the dev override cookie, if any. */
  devCookie?: string | null
  /** Value of the ?__host= query param, if any. */
  devParam?: string | null
  env?: Record<string, string | undefined>
}

/**
 * Which front-end serves this request. The dev override is honoured ONLY when
 * NODE_ENV !== 'production' — in production the Host header alone decides.
 */
export function resolveSite({ host, devCookie, devParam, env = process.env }: SiteInput): Site {
  if (isVipHost(host, env)) return 'vip'
  if (env.NODE_ENV !== 'production') {
    if (devParam === 'vip') return 'vip'
    if (devParam === 'global') return 'global'
    if (devCookie === 'vip') return 'vip'
  }
  return 'global'
}

export type RouteDecision =
  | { kind: 'next' } // serve as-is
  | { kind: 'rewrite'; path: string } // serve a different internal path
  | { kind: 'not-found' } // 404

/**
 * Paths the .vip host serves WITHOUT rewriting into /vip:
 *  - Next internals and static assets (/_next/…, files with an extension)
 *  - next-auth's own endpoints (/api/auth/…) — session reads by SessionProvider
 *  - the clubhouse's own APIs (/api/vip/…) and the SSO consume endpoint
 */
const VIP_PASSTHROUGH_API = [/^\/api\/auth(\/|$)/, /^\/api\/vip(\/|$)/, /^\/api\/sso$/]

/** .global's PWA files must never be served on .vip (would install the store's worker). */
const VIP_BLOCKED_FILES = new Set(['/service-worker.js', '/manifest.json', '/sitemap.xml'])

function hasFileExtension(pathname: string): boolean {
  return /\/[^/]+\.[a-z0-9]{1,8}$/i.test(pathname)
}

export function routeFor(site: Site, pathname: string): RouteDecision {
  if (site === 'global') {
    // The clubhouse's internal segment and APIs are not reachable on .global.
    if (pathname === VIP_PREFIX || pathname.startsWith(`${VIP_PREFIX}/`)) return { kind: 'not-found' }
    if (/^\/api\/vip(\/|$)/.test(pathname) || pathname === '/api/sso') return { kind: 'not-found' }
    return { kind: 'next' }
  }

  // ── .vip ──
  if (pathname.startsWith('/_next/')) return { kind: 'next' }
  if (pathname === '/robots.txt') return { kind: 'rewrite', path: `${VIP_PREFIX}/robots.txt` }
  if (VIP_BLOCKED_FILES.has(pathname)) return { kind: 'not-found' }
  if (pathname.startsWith('/api/')) {
    return VIP_PASSTHROUGH_API.some((re) => re.test(pathname)) ? { kind: 'next' } : { kind: 'not-found' }
  }
  // Already-internal paths (e.g. a client navigation that carries the prefix)
  // are served as-is rather than double-prefixed.
  if (pathname === VIP_PREFIX || pathname.startsWith(`${VIP_PREFIX}/`)) return { kind: 'next' }
  if (hasFileExtension(pathname)) return { kind: 'next' } // public/ brand assets
  return { kind: 'rewrite', path: pathname === '/' ? VIP_PREFIX : `${VIP_PREFIX}${pathname}` }
}
