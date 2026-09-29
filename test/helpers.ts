import { NextRequest } from 'next/server'
import type { MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Clearly fake users only: zz-*@example.invalid */
let seq = 0
export function fakeEmail(tag: string) {
  seq += 1
  return `zz-${tag}-${Date.now().toString(36)}-${seq}@example.invalid`
}

export async function makeUser(opts: {
  tag: string
  tier?: MembershipTier
  status?: string
  role?: 'CUSTOMER' | 'ADMIN'
  username?: string
  suspended?: boolean
}) {
  const user = await prisma.user.create({
    data: {
      email: fakeEmail(opts.tag),
      name: `ZZ ${opts.tag}`,
      role: opts.role ?? 'CUSTOMER',
      username: opts.username,
    },
  })
  if (opts.tier && opts.tier !== 'NONE') {
    await prisma.membership.create({
      data: { userId: user.id, tier: opts.tier, status: opts.status ?? 'ACTIVE' },
    })
  }
  if (opts.suspended) {
    await prisma.vipProfile.create({ data: { userId: user.id, suspendedAt: new Date() } })
  }
  return user
}

type SessionState = { session: null | { user: Record<string, unknown> } }
const state = () => (globalThis as Record<string, unknown>).__vipTestSession as SessionState

export function setSession(user: { id: string; email: string; role?: string } | null) {
  state().session = user
    ? { user: { id: user.id, email: user.email, role: user.role ?? 'CUSTOMER', name: null } }
    : null
}

let ipSeq = 0
/** A request with a unique client IP so in-memory rate limits never bleed between tests. */
export function req(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  ipSeq += 1
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.0.${Math.floor(ipSeq / 250)}.${ipSeq % 250}`,
    ...(init.headers ?? {}),
  }
  let body: BodyInit | undefined
  if (init.body !== undefined) {
    headers['content-type'] = headers['content-type'] ?? 'application/json'
    body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body)
  }
  return new NextRequest(new URL(url, 'http://vitalityproject.vip'), {
    method: init.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
  })
}

export const params = <T extends Record<string, unknown>>(p: T) => ({ params: Promise.resolve(p) })
