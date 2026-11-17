import { describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { decode } from 'next-auth/jwt'
import { GET as ssoGET } from '@/app/api/sso/route'
import { mintSsoToken } from '@/lib/sso'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { safeCallbackPath } from '@/lib/vip/sso-consume'
import { prisma } from '@/lib/prisma'
import { makeUser, req } from '../helpers'

const SECRET = () => process.env.VIP_SSO_SECRET!

function sessionCookie(res: Response): string | null {
  const raw = res.headers.get('set-cookie') || ''
  const m = new RegExp(`${SESSION_COOKIE_NAME.replace(/[.]/g, '\\.')}=([^;]*)`).exec(raw)
  return m ? m[1] : null
}

async function consume(token: string, callbackUrl = '/dashboard') {
  return ssoGET(req(`/api/sso?token=${encodeURIComponent(token)}&callbackUrl=${encodeURIComponent(callbackUrl)}`))
}

describe('SSO consume (/api/sso)', () => {
  it('valid token → session for the SAME user row, redirect to the member home (/dashboard)', async () => {
    const user = await makeUser({ tag: 'sso-ok', tier: 'PLUS' })
    const res = await consume(mintSsoToken({ sub: user.id, email: user.email }))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!, 'http://vip.test').pathname).toBe('/dashboard')
    // relative Location: stays on whatever host the member is on (.vip)
    expect(res.headers.get('location')).toBe('/dashboard')
    const cookie = sessionCookie(res)
    expect(cookie).toBeTruthy()
    const decoded = await decode({ token: cookie!, secret: process.env.NEXTAUTH_SECRET! })
    expect(decoded?.id).toBe(user.id)
    expect(decoded?.sub).toBe(user.id)
    expect(decoded?.email).toBe(user.email)
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect(res.headers.get('set-cookie')).not.toMatch(/Domain=/i)
  })

  it('replayed token → rejected the second time', async () => {
    const user = await makeUser({ tag: 'sso-replay', tier: 'CLUB' })
    const token = mintSsoToken({ sub: user.id, email: user.email })
    const first = await consume(token)
    expect(sessionCookie(first)).toBeTruthy()
    const second = await consume(token)
    expect(sessionCookie(second)).toBeNull()
    const loc = new URL(second.headers.get('location')!, 'http://vip.test')
    expect(loc.pathname).toBe('/signin')
    expect(loc.searchParams.get('error')).toBe('sso_used')
  })

  it('expired token → rejected', async () => {
    const user = await makeUser({ tag: 'sso-expired', tier: 'CLUB' })
    const token = jwt.sign(
      { email: user.email, exp: Math.floor(Date.now() / 1000) - 5 },
      SECRET(),
      { subject: user.id, issuer: 'vitalityproject', jwtid: randomUUID(), algorithm: 'HS256' },
    )
    const res = await consume(token)
    expect(sessionCookie(res)).toBeNull()
    expect(new URL(res.headers.get('location')!, 'http://vip.test').searchParams.get('error')).toBe('sso_invalid')
    // an expired token never reaches the replay table
    expect(await prisma.vipSsoConsumedToken.count({ where: { userId: user.id } })).toBe(0)
  })

  it('bad signature → rejected', async () => {
    const user = await makeUser({ tag: 'sso-badsig', tier: 'CLUB' })
    const forged = jwt.sign({ email: user.email }, 'not-the-shared-secret', {
      subject: user.id,
      issuer: 'vitalityproject',
      expiresIn: 120,
      jwtid: randomUUID(),
    })
    const res = await consume(forged)
    expect(sessionCookie(res)).toBeNull()
    expect(new URL(res.headers.get('location')!, 'http://vip.test').searchParams.get('error')).toBe('sso_invalid')
  })

  it('tampered payload, wrong issuer, alg=none, missing token → rejected', async () => {
    const user = await makeUser({ tag: 'sso-misc', tier: 'CLUB' })
    const good = mintSsoToken({ sub: user.id, email: user.email })
    const [h, , s] = good.split('.')
    const other = await makeUser({ tag: 'sso-victim', tier: 'CLUB' })
    const payload = Buffer.from(
      JSON.stringify({ sub: other.id, iss: 'vitalityproject', jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString('base64url')
    const wrongIss = jwt.sign({}, SECRET(), { subject: user.id, issuer: 'someone-else', expiresIn: 60, jwtid: randomUUID() })
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`
    for (const t of [`${h}.${payload}.${s}`, wrongIss, none, '']) {
      const res = await consume(t)
      expect(sessionCookie(res), t.slice(0, 20)).toBeNull()
    }
  })

  it('email claim must match the user row', async () => {
    const user = await makeUser({ tag: 'sso-email', tier: 'CLUB' })
    const res = await consume(mintSsoToken({ sub: user.id, email: 'zz-someone-else@example.invalid' }))
    expect(sessionCookie(res)).toBeNull()
  })

  it('callbackUrl is restricted to same-site paths', () => {
    expect(safeCallbackPath('/dashboard')).toBe('/dashboard')
    expect(safeCallbackPath('/classroom')).toBe('/classroom')
    expect(safeCallbackPath('https://evil.example')).toBe('/dashboard')
    expect(safeCallbackPath('//evil.example')).toBe('/dashboard')
    expect(safeCallbackPath('/\\evil.example')).toBe('/dashboard')
    expect(safeCallbackPath(null)).toBe('/dashboard')
  })

  it('callbackUrl: browsers strip tab/CR/LF from a Location, so "/\\t/evil" must not become //evil', async () => {
    // A browser resolving the Location removes ASCII tab and newline first;
    // whatever we emit must still resolve to the clubhouse origin.
    const base = 'https://vitalityproject.vip'
    const resolve = (p: string) => new URL(p.replace(/[\t\n\r]/g, ''), base)
    for (const evil of ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/%09/evil.example']) {
      expect(resolve(safeCallbackPath(evil)).origin, JSON.stringify(evil)).toBe(base)
    }
    // the end-to-end route too
    const user = await makeUser({ tag: 'sso-tab', tier: 'CLUB' })
    const res = await consume(mintSsoToken({ sub: user.id, email: user.email }), '/\t/evil.example/path')
    expect(resolve(res.headers.get('location')!).origin).toBe(base)
    // legitimate paths with a query survive
    expect(safeCallbackPath('/classroom/foundations?x=1#m')).toBe('/classroom/foundations?x=1#m')
  })
})
