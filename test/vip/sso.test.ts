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
  it('valid token → session for the SAME user row, redirect to /feed', async () => {
    const user = await makeUser({ tag: 'sso-ok', tier: 'PLUS' })
    const res = await consume(mintSsoToken({ sub: user.id, email: user.email }))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!, 'http://vip.test').pathname).toBe('/feed')
    // relative Location: stays on whatever host the member is on (.vip)
    expect(res.headers.get('location')).toBe('/feed')
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
    expect(safeCallbackPath('/dashboard')).toBe('/feed')
    expect(safeCallbackPath('/classroom')).toBe('/classroom')
    expect(safeCallbackPath('https://evil.example')).toBe('/feed')
    expect(safeCallbackPath('//evil.example')).toBe('/feed')
    expect(safeCallbackPath('/\\evil.example')).toBe('/feed')
    expect(safeCallbackPath(null)).toBe('/feed')
  })
})
