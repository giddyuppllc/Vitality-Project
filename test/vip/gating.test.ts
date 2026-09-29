import { beforeAll, describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeUser, params, req, setSession } from '../helpers'
import { requireVipPage } from '@/lib/vip/page-gate'

import * as posts from '@/app/api/vip/posts/route'
import * as post from '@/app/api/vip/posts/[id]/route'
import * as comments from '@/app/api/vip/posts/[id]/comments/route'
import * as comment from '@/app/api/vip/comments/[id]/route'
import * as reactions from '@/app/api/vip/reactions/route'
import * as reports from '@/app/api/vip/reports/route'
import * as notifications from '@/app/api/vip/notifications/route'
import * as profile from '@/app/api/vip/profile/route'
import * as members from '@/app/api/vip/members/route'
import * as uploads from '@/app/api/vip/uploads/route'
import * as media from '@/app/api/vip/media/[...path]/route'
import * as progress from '@/app/api/vip/lessons/[id]/progress/route'
import * as rsvp from '@/app/api/vip/events/[id]/rsvp/route'
import * as rewards from '@/app/api/vip/rewards/route'
import * as adminSpaces from '@/app/api/admin/vip/spaces/route'
import * as adminSpace from '@/app/api/admin/vip/spaces/[id]/route'
import * as adminModeration from '@/app/api/admin/vip/moderation/route'
import * as adminClassroom from '@/app/api/admin/vip/classroom/route'
import * as adminEvents from '@/app/api/admin/vip/events/route'
import * as adminRewards from '@/app/api/admin/vip/rewards/route'

type Handler = (r: NextRequest, ctx: { params: Promise<Record<string, unknown>> }) => Promise<Response>
type Case = { name: string; gate: 'community' | 'member'; run: () => Promise<Response> }

let postId = 'missing'
const ctx = (p: Record<string, unknown>) => params(p)
const h = (fn: unknown) => fn as Handler

// Every member-facing clubhouse API handler, with its gate level.
const CASES: Case[] = [
  { name: 'GET /posts', gate: 'community', run: () => h(posts.GET)(req('/api/vip/posts'), ctx({})) },
  { name: 'POST /posts', gate: 'community', run: () => h(posts.POST)(req('/api/vip/posts', { body: { body: `gate ${Math.random()}` } }), ctx({})) },
  { name: 'GET /posts/:id', gate: 'community', run: () => h(post.GET)(req(`/api/vip/posts/${postId}`), ctx({ id: postId })) },
  { name: 'PATCH /posts/:id', gate: 'community', run: () => h(post.PATCH)(req(`/api/vip/posts/${postId}`, { method: 'PATCH', body: { body: 'x' } }), ctx({ id: postId })) },
  { name: 'DELETE /posts/:id', gate: 'community', run: () => h(post.DELETE)(req(`/api/vip/posts/${postId}`, { method: 'DELETE' }), ctx({ id: postId })) },
  { name: 'POST /posts/:id/comments', gate: 'community', run: () => h(comments.POST)(req(`/api/vip/posts/${postId}/comments`, { body: { body: `c ${Math.random()}` } }), ctx({ id: postId })) },
  { name: 'DELETE /comments/:id', gate: 'community', run: () => h(comment.DELETE)(req('/api/vip/comments/missing', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'POST /reactions', gate: 'community', run: () => h(reactions.POST)(req('/api/vip/reactions', { body: { postId } }), ctx({})) },
  { name: 'POST /reports', gate: 'community', run: () => h(reports.POST)(req('/api/vip/reports', { body: { postId, reason: 'gate test' } }), ctx({})) },
  { name: 'GET /notifications', gate: 'community', run: () => h(notifications.GET)(req('/api/vip/notifications'), ctx({})) },
  { name: 'POST /notifications', gate: 'community', run: () => h(notifications.POST)(req('/api/vip/notifications', { body: { all: true } }), ctx({})) },
  { name: 'PATCH /profile', gate: 'community', run: () => h(profile.PATCH)(req('/api/vip/profile', { method: 'PATCH', body: { bio: 'x' } }), ctx({})) },
  { name: 'GET /members', gate: 'community', run: () => h(members.GET)(req('/api/vip/members'), ctx({})) },
  { name: 'POST /uploads', gate: 'community', run: () => h(uploads.POST)(req('/api/vip/uploads', { body: {} }), ctx({})) },
  { name: 'GET /profile', gate: 'member', run: () => h(profile.GET)(req('/api/vip/profile'), ctx({})) },
  { name: 'GET /media/*', gate: 'member', run: () => h(media.GET)(req('/api/vip/media/2026-01/x.jpg'), ctx({ path: ['2026-01', 'x.jpg'] })) },
  { name: 'POST /lessons/:id/progress', gate: 'member', run: () => h(progress.POST)(req('/api/vip/lessons/missing/progress', { method: 'POST' }), ctx({ id: 'missing' })) },
  { name: 'DELETE /lessons/:id/progress', gate: 'member', run: () => h(progress.DELETE)(req('/api/vip/lessons/missing/progress', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'POST /events/:id/rsvp', gate: 'member', run: () => h(rsvp.POST)(req('/api/vip/events/missing/rsvp', { method: 'POST' }), ctx({ id: 'missing' })) },
  { name: 'DELETE /events/:id/rsvp', gate: 'member', run: () => h(rsvp.DELETE)(req('/api/vip/events/missing/rsvp', { method: 'DELETE' }), ctx({ id: 'missing' })) },
  { name: 'GET /rewards', gate: 'member', run: () => h(rewards.GET)(req('/api/vip/rewards'), ctx({})) },
]

const ADMIN_CASES: { name: string; run: () => Promise<Response> }[] = [
  { name: 'GET spaces', run: () => h(adminSpaces.GET)(req('/api/admin/vip/spaces'), ctx({})) },
  { name: 'POST spaces', run: () => h(adminSpaces.POST)(req('/api/admin/vip/spaces', { body: { name: 'x' } }), ctx({})) },
  { name: 'PATCH space', run: () => h(adminSpace.PATCH)(req('/api/admin/vip/spaces/x', { method: 'PATCH', body: {} }), ctx({ id: 'x' })) },
  { name: 'POST moderation', run: () => h(adminModeration.POST)(req('/api/admin/vip/moderation', { body: { action: 'hide_post', postId } }), ctx({})) },
  { name: 'POST classroom', run: () => h(adminClassroom.POST)(req('/api/admin/vip/classroom', { body: { op: 'course.delete', id: 'x' } }), ctx({})) },
  { name: 'POST events', run: () => h(adminEvents.POST)(req('/api/admin/vip/events', { body: { op: 'delete', id: 'x' } }), ctx({})) },
  { name: 'GET rewards', run: () => h(adminRewards.GET)(req('/api/admin/vip/rewards'), ctx({})) },
  { name: 'PUT rewards', run: () => h(adminRewards.PUT)(req('/api/admin/vip/rewards', { method: 'PUT', body: { CLUB: 1, PLUS: 1, PREMIUM: 1 } }), ctx({})) },
]

let users: Record<string, { id: string; email: string; role: string }>

beforeAll(async () => {
  const author = await makeUser({ tag: 'gate-author', tier: 'PREMIUM' })
  postId = (await prisma.vipPost.create({ data: { authorId: author.id, body: 'gate fixture post' } })).id
  users = {
    none: await makeUser({ tag: 'gate-none' }),
    pending: await makeUser({ tag: 'gate-pending', tier: 'PLUS', status: 'PENDING_PAYMENT' }),
    pastDue: await makeUser({ tag: 'gate-pastdue', tier: 'PREMIUM', status: 'PAST_DUE' }),
    cancelled: await makeUser({ tag: 'gate-cancelled', tier: 'CLUB', status: 'CANCELLED' }),
    suspended: await makeUser({ tag: 'gate-suspended', tier: 'PLUS', suspended: true }),
    member: await makeUser({ tag: 'gate-member', tier: 'CLUB' }),
  }
})

describe('members-only gating — every clubhouse API', () => {
  it('covers every route file under src/app/api/vip (a new route must be added here)', () => {
    const root = path.resolve(__dirname, '../../src/app/api/vip')
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (f === 'route.ts') files.push(path.relative(root, p).replace(/\\/g, '/'))
      }
    }
    walk(root)
    // auth/login + auth/logout are intentionally public (they create/clear the session).
    const gated = files.filter((f) => !f.startsWith('auth/'))
    expect(gated.sort()).toEqual(
      [
        'comments/[id]/route.ts', 'events/[id]/rsvp/route.ts', 'lessons/[id]/progress/route.ts', 'media/[...path]/route.ts',
        'members/route.ts', 'notifications/route.ts', 'posts/[id]/comments/route.ts', 'posts/[id]/route.ts', 'posts/route.ts',
        'profile/route.ts', 'reactions/route.ts', 'reports/route.ts', 'rewards/route.ts', 'uploads/route.ts',
      ].sort(),
    )
  })

  it('signed out → 401 everywhere', async () => {
    setSession(null)
    for (const c of CASES) {
      const res = await c.run()
      expect(res.status, c.name).toBe(401)
      expect(res.headers.get('cache-control'), c.name).toContain('no-store')
      expect(res.headers.get('x-robots-tag'), c.name).toContain('noindex')
    }
  })

  for (const who of ['none', 'pending', 'pastDue', 'cancelled'] as const) {
    it(`no active membership (${who}) → 403 everywhere`, async () => {
      setSession(users[who])
      for (const c of CASES) {
        const res = await c.run()
        expect(res.status, `${who} ${c.name}`).toBe(403)
        expect((await res.json()).error, c.name).toBe('membership_required')
      }
    })
  }

  it('community-suspended member → 403 on community APIs, still allowed on member APIs', async () => {
    setSession(users.suspended)
    for (const c of CASES) {
      const res = await c.run()
      if (c.gate === 'community') {
        expect(res.status, c.name).toBe(403)
        expect((await res.json()).error, c.name).toBe('community_suspended')
      } else {
        expect([200, 201, 404], c.name).toContain(res.status)
      }
    }
  })

  it('active member → passes the gate everywhere (never 401/403 from the gate)', async () => {
    setSession(users.member)
    for (const c of CASES) {
      const res = await c.run()
      expect([401].includes(res.status), c.name).toBe(false)
      if (res.status === 403) {
        // only an ownership check may 403 an active member (editing someone else's post)
        expect(['PATCH /posts/:id', 'DELETE /posts/:id'], c.name).toContain(c.name)
      }
    }
  })

  it('admin APIs → 401 for members and signed-out users', async () => {
    for (const who of [null, users.member]) {
      setSession(who)
      for (const c of ADMIN_CASES) {
        expect((await c.run()).status, `${who ? 'member' : 'anon'} ${c.name}`).toBe(401)
      }
    }
  })

  it('pages: signed out → /signin, non-member → /, suspended → /suspended on community pages', async () => {
    const redirectOf = async () => {
      try {
        await requireVipPage('community')
        return null
      } catch (e) {
        const digest = String((e as { digest?: string }).digest || '')
        return digest.split(';')[2] ?? digest
      }
    }
    setSession(null)
    expect(await redirectOf()).toBe('/signin')
    setSession(users.pastDue)
    expect(await redirectOf()).toBe('/')
    setSession(users.suspended)
    expect(await redirectOf()).toBe('/suspended')
    setSession(users.member)
    expect(await redirectOf()).toBeNull()
  })
})
