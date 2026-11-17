import { beforeAll, describe, expect, it } from 'vitest'
import type { NextRequest } from 'next/server'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { makeUser, params, req, setSession } from '../helpers'
import * as messages from '@/app/api/vip/messages/route'
import * as conversation from '@/app/api/vip/messages/[id]/route'
import * as posts from '@/app/api/vip/posts/route'
import * as reports from '@/app/api/vip/reports/route'
import * as media from '@/app/api/vip/media/[...path]/route'
import * as adminMedia from '@/app/api/admin/vip/media/[...path]/route'
import { saveMemberImage } from '@/lib/vip/media'

/**
 * Direct-message photos are private to the conversation. Before the
 * integration they were served by the members-only media route like any post
 * photo, so any signed-in member holding the link could load one.
 */
type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => (fn as H)(r, params(p))
type U = Awaited<ReturnType<typeof makeUser>>

async function photo(color: string) {
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: color } }).png().toBuffer()
  const saved = await saveMemberImage(png)
  if (!saved.ok) throw new Error(saved.error)
  return saved.url
}
const segs = (url: string) => url.replace('/api/vip/media/', '').split('/')
async function load(as: U, url: string) {
  setSession(as)
  const res = await call(media.GET, req(url), { path: segs(url) })
  return res
}
async function open(as: U, body: Record<string, unknown>) {
  setSession(as)
  const res = await call(messages.POST, req('/api/vip/messages', { body }))
  return (await res.json()).id as string
}
async function send(as: U, convId: string, body: Record<string, unknown>) {
  setSession(as)
  const res = await call(conversation.POST, req(`/api/vip/messages/${convId}`, { body }), { id: convId })
  return { status: res.status, data: await res.json() }
}

let amy: U, bo: U, cy: U, dee: U, admin: U, susp: U

beforeAll(async () => {
  amy = await makeUser({ tag: 'dmp-amy', tier: 'PLUS', username: 'zz_dmp_amy' })
  bo = await makeUser({ tag: 'dmp-bo', tier: 'CLUB', username: 'zz_dmp_bo' })
  cy = await makeUser({ tag: 'dmp-cy', tier: 'PREMIUM' })
  dee = await makeUser({ tag: 'dmp-dee', tier: 'CLUB' })
  admin = await makeUser({ tag: 'dmp-admin', role: 'ADMIN' })
  susp = await makeUser({ tag: 'dmp-susp', tier: 'CLUB' })
})

describe('DM photo attachments', () => {
  it('load for the conversation participants and nobody else — not other members, not admins', async () => {
    const dm = await open(amy, { recipientId: bo.id })
    const url = await photo('#1d6fd6')
    expect((await send(amy, dm, { body: '', imageUrl: url })).status).toBe(201)

    const mine = await load(amy, url)
    expect(mine.status).toBe(200)
    expect(mine.headers.get('cache-control')).toBe('private, no-store')
    expect((await load(bo, url)).status).toBe(200)

    // A member who got hold of the link: same 404 as a missing file.
    expect((await load(cy, url)).status).toBe(404)
    // Admins don't browse DMs through the members' route either.
    expect((await load({ ...admin, role: 'ADMIN' } as U, url)).status).toBe(404)
  })

  it('a participant who leaves a group loses its photos', async () => {
    const group = await open(amy, { memberIds: [bo.id, dee.id], title: 'zz dmp group' })
    const url = await photo('#d4b26a')
    expect((await send(amy, group, { body: 'zz group photo', imageUrl: url })).status).toBe(201)
    expect((await load(dee, url)).status).toBe(200)
    setSession(dee)
    expect((await call(conversation.DELETE, req(`/api/vip/messages/${group}`, { method: 'DELETE' }), { id: group })).status).toBe(200)
    expect((await load(dee, url)).status).toBe(404)
    expect((await load(bo, url)).status).toBe(200)
  })

  it('a community-suspended participant loses them too', async () => {
    const dm = await open(amy, { recipientId: susp.id })
    const url = await photo('#22aa66')
    expect((await send(amy, dm, { body: '', imageUrl: url })).status).toBe(201)
    expect((await load(susp, url)).status).toBe(200)
    await prisma.vipProfile.upsert({ where: { userId: susp.id }, update: { suspendedAt: new Date() }, create: { userId: susp.id, suspendedAt: new Date() } })
    expect((await load(susp, url)).status).toBe(404)
  })

  it('post photos stay visible to every member, and a DM cannot capture one', async () => {
    const url = await photo('#aa2266')
    setSession(cy)
    const p = await call(posts.POST, req('/api/vip/posts', { body: { body: 'zz post with a photo', images: [url] } }))
    expect(p.status).toBe(201)
    expect((await load(amy, url)).status).toBe(200)

    // Re-sending the post's photo link in a DM is refused (it would hide the
    // post photo from everyone outside the chat).
    const dm = await open(cy, { recipientId: bo.id })
    expect((await send(cy, dm, { body: '', imageUrl: url })).status).toBe(400)
    expect((await load(amy, url)).status).toBe(200)
  })

  it('re-using a DM photo link in a post does not publish it', async () => {
    const dm = await open(amy, { recipientId: bo.id })
    const url = await photo('#6622aa')
    await send(amy, dm, { body: '', imageUrl: url })
    setSession(bo)
    await call(posts.POST, req('/api/vip/posts', { body: { body: 'zz trying to publish a dm photo', images: [url] } }))
    expect((await load(cy, url)).status).toBe(404)
  })

  it('admins see a photo only through the admin route, only once the conversation is reported', async () => {
    const dm = await open(cy, { recipientId: amy.id })
    const url = await photo('#888888')
    const m = await send(cy, dm, { body: 'zz reported photo', imageUrl: url })
    const a = { ...admin, role: 'ADMIN' } as U
    setSession(a)
    expect((await call(adminMedia.GET, req(`/api/admin/vip/media/${segs(url).join('/')}?c=${dm}`), { path: segs(url) })).status).toBe(404)
    setSession(amy)
    expect((await call(reports.POST, req('/api/vip/reports', { body: { messageId: m.data.message.id, reason: 'zz test report' } }))).status).toBe(201)
    setSession(a)
    expect((await call(adminMedia.GET, req(`/api/admin/vip/media/${segs(url).join('/')}?c=${dm}`), { path: segs(url) })).status).toBe(200)
    // …and still never through the members' route.
    expect((await load(a, url)).status).toBe(404)
  })
})
