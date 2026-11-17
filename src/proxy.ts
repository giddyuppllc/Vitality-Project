import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { publicUrl } from '@/lib/public-url'
import {
  DEV_HOST_PARAM,
  DEV_SITE_COOKIE,
  SITE_HEADER,
  VIP_PREFIX,
  resolveSite,
  routeFor,
} from '@/lib/vip/host'

/**
 * Host-based split between the two front-ends of this one app
 * (docs/VIP_CLUBHOUSE.md §Architecture):
 *
 *  - .global hosts: passed straight through. The ONLY difference from before
 *    this file existed is that the clubhouse's internal paths (/vip…,
 *    /api/vip…, /api/sso) answer 404 here.
 *  - VIP_HOST (vitalityproject.vip + www.): every page path is rewritten into
 *    src/app/vip, store APIs are 404, and every response carries
 *    `X-Robots-Tag: noindex, nofollow` — the clubhouse is private.
 *
 * Local dev: `?__host=vip` pins the clubhouse on localhost (cookie), and
 * `?__host=global` unpins it. Ignored when NODE_ENV=production.
 */
export function proxy(request: NextRequest): NextResponse | Promise<NextResponse> {
  const { pathname } = request.nextUrl
  if (isAdminPage(pathname) && resolveSiteFor(request) === 'global') return guardAdmin(request)
  return route(request)
}

function resolveSiteFor(request: NextRequest) {
  return resolveSite({
    host: request.headers.get('host'),
    devCookie: request.cookies.get(DEV_SITE_COOKIE)?.value ?? null,
    devParam: request.nextUrl.searchParams.get(DEV_HOST_PARAM),
  })
}

/**
 * /admin pages on .global: the role check in src/app/admin/layout.tsx is not
 * an access boundary on its own — for a client navigation Next renders only
 * the segments that changed, so a request that claims the admin layout is
 * already on screen (RSC: 1 + Next-Router-State-Tree) got any admin page's
 * data without the layout running (proven: anonymous requests read
 * /admin/customers and /admin/members). Same rule and destination as the
 * layout: role ADMIN on the session token, else /auth/login. /api/admin/*
 * is not touched (every handler checks for itself).
 */
const isAdminPage = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/')

// Same name lib/auth.ts gives the next-auth session cookie (not imported:
// lib/auth pulls Prisma into the proxy bundle).
const SESSION_COOKIE = `${(process.env.NEXTAUTH_URL || '').startsWith('https://') ? '__Secure-' : ''}next-auth.session-token`

async function guardAdmin(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: SESSION_COOKIE,
  }).catch(() => null)
  if (token?.role !== 'ADMIN') {
    return NextResponse.redirect(publicUrl(request, '/auth/login'), { headers: { 'Cache-Control': 'no-store' } })
  }
  return route(request)
}

function route(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl
  const devParam = searchParams.get(DEV_HOST_PARAM)
  const site = resolveSite({
    // Host only (nginx forwards it as `proxy_set_header Host $host`).
    host: request.headers.get('host'),
    devCookie: request.cookies.get(DEV_SITE_COOKIE)?.value ?? null,
    devParam,
  })
  const decision = routeFor(site, pathname)

  // Tell the root layout which site this is (it renders a bare document for
  // the clubhouse). Never trust a client-sent value: strip it, then set it
  // only on the clubhouse host. .global requests without the header are
  // passed through untouched.
  let forward: { request: { headers: Headers } } | undefined
  if (site === 'vip' || request.headers.has(SITE_HEADER)) {
    const h = new Headers(request.headers)
    h.delete(SITE_HEADER)
    if (site === 'vip') h.set(SITE_HEADER, 'vip')
    forward = { request: { headers: h } }
  }

  let response: NextResponse
  if (decision.kind === 'next') {
    response = forward ? NextResponse.next(forward) : NextResponse.next()
  } else if (decision.kind === 'rewrite') {
    const url = request.nextUrl.clone()
    url.pathname = decision.path
    response = forward ? NextResponse.rewrite(url, forward) : NextResponse.rewrite(url)
  } else if (pathname.startsWith('/api/')) {
    response = NextResponse.json({ error: 'Not found' }, { status: 404 })
  } else {
    // Rewrite to a path no route matches → the site's own 404 page + status.
    const url = request.nextUrl.clone()
    url.pathname = site === 'vip' ? `${VIP_PREFIX}/__not-found` : '/__not-found'
    response = forward ? NextResponse.rewrite(url, forward) : NextResponse.rewrite(url)
  }

  if (site === 'vip') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }

  if (process.env.NODE_ENV !== 'production' && devParam) {
    if (devParam === 'vip') response.cookies.set(DEV_SITE_COOKIE, 'vip', { path: '/', sameSite: 'lax' })
    if (devParam === 'global') response.cookies.delete(DEV_SITE_COOKIE)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
