import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { POST as loginPOST } from '@/app/api/vip/auth/login/route'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fakeEmail, req } from '../helpers'

async function userWithPassword(tag: string, password: string) {
  return prisma.user.create({
    data: { email: fakeEmail(tag), name: `ZZ ${tag}`, passwordHash: await bcrypt.hash(password, 4) },
  })
}

const hasSession = (res: Response) => (res.headers.get('set-cookie') || '').includes(`${SESSION_COOKIE_NAME}=`)

describe('direct sign-in on .vip (/api/vip/auth/login)', () => {
  it('right password → session cookie; wrong password → 401, no cookie', async () => {
    const u = await userWithPassword('login-ok', 'zz-correct-horse')
    const ok = await loginPOST(req('/api/vip/auth/login', { body: { identifier: u.email, password: 'zz-correct-horse' } }))
    expect(ok.status).toBe(200)
    expect(hasSession(ok)).toBe(true)
    const bad = await loginPOST(req('/api/vip/auth/login', { body: { identifier: u.email, password: 'nope' } }))
    expect(bad.status).toBe(401)
    expect(hasSession(bad)).toBe(false)
  })

  it('login CSRF: only a real application/json body is accepted (no CORS-safelisted type)', async () => {
    const u = await userWithPassword('login-csrf', 'zz-correct-horse')
    const body = JSON.stringify({ identifier: u.email, password: 'zz-correct-horse' })
    // A cross-site page can send these without a preflight: the MIME essence
    // is text/plain (or a form type), even though the string mentions JSON.
    for (const ct of [
      'text/plain',
      'text/plain; application/json',
      'text/plain;charset=application/json',
      'application/x-www-form-urlencoded; x=application/json',
      'multipart/form-data; boundary=application/json',
    ]) {
      const res = await loginPOST(req('/api/vip/auth/login', { body, headers: { 'content-type': ct } }))
      expect(res.status, ct).toBe(415)
      expect(hasSession(res), ct).toBe(false)
    }
    const ok = await loginPOST(req('/api/vip/auth/login', { body, headers: { 'content-type': 'application/json; charset=utf-8' } }))
    expect(ok.status).toBe(200)
  })
})
