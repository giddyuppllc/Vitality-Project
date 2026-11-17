import { beforeAll, describe, expect, it } from 'vitest'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeUser, params, req, setSession } from '../helpers'
import * as messages from '@/app/api/vip/messages/route'
import * as conversation from '@/app/api/vip/messages/[id]/route'
import * as unread from '@/app/api/vip/messages/unread/route'
import * as reports from '@/app/api/vip/reports/route'
import * as profileApi from '@/app/api/vip/profile/route'
import * as follow from '@/app/api/vip/members/[id]/follow/route'
import * as block from '@/app/api/vip/members/[id]/block/route'
import * as adminMedia from '@/app/api/admin/vip/media/[...path]/route'
import AdminConversationPage from '@/app/admin/vip/conversations/[id]/page'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { saveMemberImage } from '@/lib/vip/media'

type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => (fn as H)(r, params(p))
type U = Awaited<ReturnType<typeof makeUser>>

async function open(as: U, body: Record<string, unknown>) {
  setSession(as)
  const res = await call(messages.POST, req('/api/vip/messages', { body }))
  return { status: res.status, data: await res.json() }
}
async function send(as: U, convId: string, body: Record<string, unknown>) {
  setSession(as)
  const res = await call(conversation.POST, req(`/api/vip/messages/${convId}`, { body }), { id: convId })
  return { status: res.status, data: await res.json() }
}
async function read(as: U, convId: string, qs = '') {
  setSession(as)
  const res = await call(conversation.GET, req(`/api/vip/messages/${convId}${qs}`), { id: convId })
  return { status: res.status, data: res.status === 200 ? await res.json() : null }
}
async function unreadCount(as: U) {
  setSession(as)
  return (await (await call(unread.GET, req('/api/vip/messages/unread'))).json()).unread as number
}
async function setDmPolicy(as: U, dmPolicy: string) {
  setSession(as)
  expect((await call(profileApi.PATCH, req('/api/vip/profile', { method: 'PATCH', body: { dmPolicy } }))).status).toBe(200)
}

let amy: U, bo: U, cy: U, lapsed: U, susp: U, admin: U
let dm: string
let amyMsg: string

beforeAll(async () => {
  amy = await makeUser({ tag: 'dm-amy', tier: 'PLUS', username: 'zz_dm_amy' })
  bo = await makeUser({ tag: 'dm-bo', tier: 'CLUB', username: 'zz_dm_bo' })
  cy = await makeUser({ tag: 'dm-cy', tier: 'PREMIUM' })
  lapsed = await makeUser({ tag: 'dm-lapsed', tier: 'CLUB', status: 'CANCELLED' })
  susp = await makeUser({ tag: 'dm-susp', tier: 'CLUB', suspended: true })
  admin = await makeUser({ tag: 'dm-admin', role: 'ADMIN' })
})

describe('1:1 conversations', () => {
  it('opens once per pair (both directions) and delivers a message with unread + notification', async () => {
    const a = await open(amy, { recipientId: bo.id })
    expect(a.status).toBe(201)
    dm = a.data.id
    expect((await open(bo, { recipientId: amy.id })).data.id).toBe(dm)

    const s = await send(amy, dm, { body: 'Morning! Did you try the 5-minute wind-down?' })
    expect(s.status).toBe(201)
    amyMsg = s.data.message.id
    expect(await unreadCount(bo)).toBe(1)
    expect(await prisma.vipNotification.count({ where: { userId: bo.id, type: 'MESSAGE', conversationId: dm, readAt: null } })).toBe(1)

    // a second message while unread: still one notification
    await send(amy, dm, { body: 'No rush.' })
    expect(await prisma.vipNotification.count({ where: { userId: bo.id, type: 'MESSAGE', conversationId: dm } })).toBe(1)

    setSession(bo)
    const list = await (await call(messages.GET, req('/api/vip/messages'))).json()
    const row = list.conversations.find((c: { id: string }) => c.id === dm)
    expect(row.unread).toBe(2)
    expect(row.title).toBe('ZZ dm-amy')
  })

  it('read receipts: reading clears unread, marks the notification read and shows as seen to the sender', async () => {
    const r = await read(bo, dm, '?read=1')
    expect(r.status).toBe(200)
    expect(r.data.messages.map((m: { body: string }) => m.body)).toEqual(['Morning! Did you try the 5-minute wind-down?', 'No rush.'])
    expect(await unreadCount(bo)).toBe(0)
    expect(await prisma.vipNotification.count({ where: { userId: bo.id, type: 'MESSAGE', conversationId: dm, readAt: null } })).toBe(0)

    const asAmy = await read(amy, dm)
    const boSeen = asAmy.data.conversation.others.find((o: { id: string }) => o.id === bo.id).lastReadAt
    const last = asAmy.data.messages[asAmy.data.messages.length - 1].createdAt
    expect(boSeen >= last).toBe(true)
  })

  it('polling with ?after returns only newer messages', async () => {
    const first = await read(bo, dm)
    const after = first.data.messages[first.data.messages.length - 1].createdAt
    await send(bo, dm, { body: 'Yes — slept 7h20.' })
    const poll = await read(amy, dm, `?after=${encodeURIComponent(after)}`)
    const bodies = poll.data.messages.map((m: { body: string }) => m.body)
    expect(bodies).toContain('Yes — slept 7h20.')
    expect(bodies).not.toContain('Morning! Did you try the 5-minute wind-down?')
  })

  it('nobody else can read, send to, mark or leave someone else’s conversation', async () => {
    expect((await read(cy, dm)).status).toBe(404)
    expect((await send(cy, dm, { body: 'let me in' })).status).toBe(404)
    setSession(cy)
    expect((await call(conversation.PATCH, req(`/api/vip/messages/${dm}`, { method: 'PATCH', body: { read: true } }), { id: dm })).status).toBe(404)
    expect((await call(conversation.DELETE, req(`/api/vip/messages/${dm}`, { method: 'DELETE' }), { id: dm })).status).toBe(404)
    // admins are not participants either: no browsing private DMs
    expect((await read(admin, dm)).status).toBe(404)
  })

  it('images must come from the clubhouse upload pipeline; a shared post must be visible', async () => {
    expect((await send(amy, dm, { body: '', imageUrl: 'https://evil.example/x.jpg' })).status).toBe(400)
    // A fresh upload link (DM photos must not re-use a link used anywhere else — see dm-media-privacy.test.ts).
    expect((await send(amy, dm, { body: '', imageUrl: `/api/vip/media/2026-11/${randomUUID()}.jpg` })).status).toBe(201)
    expect((await send(amy, dm, { body: '' })).status).toBe(400)
    const p = await prisma.vipPost.create({ data: { authorId: cy.id, body: 'share me' } })
    const shared = await send(amy, dm, { body: 'look', sharedPostId: p.id })
    expect(shared.status).toBe(201)
    expect(shared.data.message.sharedPost).toMatchObject({ id: p.id, available: true })
    const hidden = await prisma.vipPost.create({ data: { authorId: cy.id, body: 'hidden', hiddenAt: new Date() } })
    expect((await send(amy, dm, { body: 'x', sharedPostId: hidden.id })).status).toBe(404)
  })
})

describe('who can message whom', () => {
  it('refuses members without an active membership and community-suspended members', async () => {
    expect((await open(amy, { recipientId: lapsed.id })).status).toBe(404)
    expect((await open(amy, { recipientId: susp.id })).status).toBe(404)
    // a suspended member loses DMs entirely (gate)
    setSession(susp)
    expect((await call(messages.GET, req('/api/vip/messages'))).status).toBe(403)
    expect((await send(susp, dm, { body: 'hi' })).status).toBe(403)
    // signed out / not a member
    setSession(null)
    expect((await call(messages.GET, req('/api/vip/messages'))).status).toBe(401)
    setSession(lapsed)
    expect((await call(messages.GET, req('/api/vip/messages'))).status).toBe(403)
  })

  it('"Nobody": no new conversation and no further sends in an existing one', async () => {
    await setDmPolicy(bo, 'NOBODY')
    expect((await open(cy, { recipientId: bo.id })).status).toBe(403)
    const s = await send(amy, dm, { body: 'still there?' })
    expect(s.status).toBe(403)
    expect(s.data.error).toMatch(/turned off direct messages/)
    expect((await read(amy, dm)).data.conversation.cannotSend).toMatch(/turned off/)
    await setDmPolicy(bo, 'EVERYONE')
  })

  it('"People I follow": only members the recipient follows', async () => {
    await setDmPolicy(cy, 'FOLLOWING')
    const r = await open(amy, { recipientId: cy.id })
    expect(r.status).toBe(403)
    expect(r.data.error).toMatch(/people they follow/)
    setSession(cy)
    await call(follow.POST, req(`/api/vip/members/${amy.id}/follow`, { method: 'POST' }), { id: amy.id })
    expect((await open(amy, { recipientId: cy.id })).status).toBe(201)
    await setDmPolicy(cy, 'EVERYONE')
  })

  it('blocks: the 1:1 disappears for both, and neither can open or send', async () => {
    setSession(bo)
    await call(block.POST, req(`/api/vip/members/${amy.id}/block`, { method: 'POST' }), { id: amy.id })
    expect((await read(amy, dm)).status).toBe(404)
    expect((await read(bo, dm)).status).toBe(404)
    expect((await send(amy, dm, { body: 'hello?' })).status).toBe(404)
    expect((await open(amy, { recipientId: bo.id })).status).toBe(403)
    setSession(amy)
    const list = await (await call(messages.GET, req('/api/vip/messages'))).json()
    expect(list.conversations.map((c: { id: string }) => c.id)).not.toContain(dm)
    setSession(bo)
    await call(block.DELETE, req(`/api/vip/members/${amy.id}/block`, { method: 'DELETE' }), { id: amy.id })
    expect((await read(amy, dm)).status).toBe(200)
  })
})

describe('group conversations', () => {
  it('creates a group, everyone reads it, a leaver loses access, and a blocked sender’s messages are hidden', async () => {
    const dee = await makeUser({ tag: 'dm-dee', tier: 'CLUB' })
    const g = await open(amy, { memberIds: [bo.id, cy.id, dee.id], title: 'Saturday long run' })
    expect(g.status).toBe(201)
    const gid = g.data.id
    await send(bo, gid, { body: 'Route at 7?' })
    for (const u of [amy, cy, dee]) expect((await read(u, gid)).data.conversation.title).toBe('Saturday long run')

    // cy blocks bo: cy no longer sees bo's group messages; others still do
    setSession(cy)
    await call(block.POST, req(`/api/vip/members/${bo.id}/block`, { method: 'POST' }), { id: bo.id })
    expect((await read(cy, gid)).data.messages.map((m: { body: string }) => m.body)).not.toContain('Route at 7?')
    expect((await read(dee, gid)).data.messages.map((m: { body: string }) => m.body)).toContain('Route at 7?')
    setSession(cy)
    await call(block.DELETE, req(`/api/vip/members/${bo.id}/block`, { method: 'DELETE' }), { id: bo.id })

    setSession(dee)
    expect((await call(conversation.DELETE, req(`/api/vip/messages/${gid}`, { method: 'DELETE' }), { id: gid })).status).toBe(200)
    expect((await read(dee, gid)).status).toBe(404)
    expect((await send(dee, gid, { body: 'back?' })).status).toBe(404)
  })

  it('caps groups at 20 people and refuses anyone who disallows messages', async () => {
    const many = await Promise.all(Array.from({ length: 20 }, (_, i) => makeUser({ tag: `dm-many-${i}`, tier: 'CLUB' })))
    const big = await open(amy, { memberIds: many.map((u) => u.id) })
    expect(big.status).toBe(400)
    expect(big.data.error).toMatch(/up to 20/)
    expect((await open(amy, { memberIds: many.slice(0, 19).map((u) => u.id) })).status).toBe(201)

    await setDmPolicy(many[0], 'NOBODY')
    const refused = await open(amy, { memberIds: [many[0].id, many[1].id] })
    expect(refused.status).toBe(403)
    expect(refused.data.error).toMatch(/can’t be added/)
  })
})

describe('reporting a message → moderation queue; admins see reported conversations only', () => {
  it('only a participant (not the sender) can report; the admin page opens only once reported', async () => {
    const fresh = await open(cy, { recipientId: amy.id })
    const convId = fresh.data.id
    // A real (tiny) photo through the private upload pipeline (private-uploads/ is git-ignored).
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#1d6fd6' } }).png().toBuffer()
    const saved = await saveMemberImage(png)
    if (!saved.ok) throw new Error(saved.error)
    const m = await send(cy, convId, { body: 'zz rude message for the report test', imageUrl: saved.url })
    const msgId = m.data.message.id

    // Admin cannot open an unreported conversation (page renders the refusal; nothing logged)
    setSession({ ...admin, role: 'ADMIN' })
    await AdminConversationPage({ params: Promise.resolve({ id: convId }) })
    expect(await prisma.auditLog.count({ where: { action: 'vip.moderation.view_reported_conversation', entityId: convId } })).toBe(0)
    const imgPath = saved.url.replace('/api/vip/media/', '').split('/')
    expect((await call(adminMedia.GET, req(`/api/admin/vip/media/${imgPath.join('/')}?c=${convId}`), { path: imgPath })).status).toBe(404)

    // non-participant and the sender can't report it
    setSession(bo)
    expect((await call(reports.POST, req('/api/vip/reports', { body: { messageId: msgId, reason: 'not mine' } }))).status).toBe(404)
    setSession(cy)
    expect((await call(reports.POST, req('/api/vip/reports', { body: { messageId: msgId, reason: 'own' } }))).status).toBe(400)

    setSession(amy)
    expect((await call(reports.POST, req('/api/vip/reports', { body: { messageId: msgId, reason: 'Abusive message' } }))).status).toBe(201)
    expect((await (await call(reports.POST, req('/api/vip/reports', { body: { messageId: msgId, reason: 'again' } }))).json()).duplicate).toBe(true)
    const rep = await prisma.vipReport.findFirstOrThrow({ where: { messageId: msgId } })
    expect(rep).toMatchObject({ conversationId: convId, status: 'OPEN', reporterId: amy.id })

    setSession({ ...admin, role: 'ADMIN' })
    await AdminConversationPage({ params: Promise.resolve({ id: convId }) })
    expect(await prisma.auditLog.count({ where: { action: 'vip.moderation.view_reported_conversation', entityId: convId } })).toBe(1)
    // the photo in the reported conversation now opens for the admin
    const media = await call(adminMedia.GET, req(`/api/admin/vip/media/${imgPath.join('/')}?c=${convId}`), { path: imgPath })
    expect(media.status).toBe(200)
    expect(media.headers.get('content-type')).toBe('image/jpeg')
    // ...but not with another conversation id
    expect((await call(adminMedia.GET, req(`/api/admin/vip/media/${imgPath.join('/')}?c=${dm}`), { path: imgPath })).status).toBe(404)
    // ...and the guard still refuses an image that isn't in that conversation
    const other = ['2026-11', '00000009-0000-4000-8000-000000000000.jpg']
    expect((await call(adminMedia.GET, req(`/api/admin/vip/media/${other.join('/')}?c=${convId}`), { path: other })).status).toBe(404)
    // members can't use the admin media route
    setSession(amy)
    expect((await call(adminMedia.GET, req(`/api/admin/vip/media/${imgPath.join('/')}?c=${convId}`), { path: imgPath })).status).toBe(401)
  })
})
