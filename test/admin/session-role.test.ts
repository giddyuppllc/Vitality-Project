import { describe, expect, it } from 'vitest'
import type { JWT } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { makeUser } from '../helpers'

/**
 * The JWT used to carry the role from sign-in for the whole 30-day session,
 * so a demoted admin kept /admin access. It is now re-read from the DB.
 */
const jwt = authOptions.callbacks!.jwt! as (args: { token: JWT; user?: unknown; trigger?: string }) => Promise<JWT>

describe('session role freshness', () => {
  it('an admin demoted to CUSTOMER loses ADMIN on the next re-check', async () => {
    const u = await makeUser({ tag: 'demote', role: 'ADMIN' })
    let token = await jwt({ token: { sub: u.id } as JWT, user: { id: u.id, role: 'ADMIN' } })
    expect(token.role).toBe('ADMIN')
    await prisma.user.update({ where: { id: u.id }, data: { role: 'CUSTOMER' } })
    // simulate the re-check interval passing
    token = await jwt({ token: { ...token, roleCheckedAt: 0 } })
    expect(token.role).toBe('CUSTOMER')
  })

  it('a deleted account keeps no role', async () => {
    const u = await makeUser({ tag: 'gone', role: 'ADMIN' })
    let token = await jwt({ token: { sub: u.id } as JWT, user: { id: u.id, role: 'ADMIN' } })
    await prisma.user.delete({ where: { id: u.id } })
    token = await jwt({ token: { ...token, roleCheckedAt: 0 } })
    expect(token.role ?? null).toBeNull()
  })

  it('within the interval, no extra DB read changes the role', async () => {
    const u = await makeUser({ tag: 'fresh', role: 'ADMIN' })
    const token = await jwt({ token: { sub: u.id } as JWT, user: { id: u.id, role: 'ADMIN' } })
    await prisma.user.update({ where: { id: u.id }, data: { role: 'CUSTOMER' } })
    expect((await jwt({ token })).role).toBe('ADMIN')
  })
})
