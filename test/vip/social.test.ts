import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { makeUser, params, req, setSession } from '../helpers'
import * as posts from '@/app/api/vip/posts/route'
import * as post from '@/app/api/vip/posts/[id]/route'
import * as comments from '@/app/api/vip/posts/[id]/comments/route'
import * as bookmarks from '@/app/api/vip/bookmarks/route'
import * as follow from '@/app/api/vip/members/[id]/follow/route'
import * as block from '@/app/api/vip/members/[id]/block/route'
import * as follows from '@/app/api/vip/members/[id]/follows/route'
import * as suggest from '@/app/api/vip/members/suggest/route'
import * as members from '@/app/api/vip/members/route'
import * as discover from '@/app/api/vip/discover/route'
import * as profileApi from '@/app/api/vip/profile/route'
import * as adminSettings from '@/app/api/admin/vip/settings/route'
import { loadProfile, suggestedMembers } from '@/lib/vip/social'
import { loadVipViewer } from '@/lib/vip/access'
import { extractHashtags, renderPostBody } from '@/lib/vip/text'
import { trendingHashtags } from '@/lib/vip/hashtags'
import { awardPostPoints, localDay } from '@/lib/vip/engagement'
import { runDigest } from '@/lib/vip/mailer'

type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => (fn as H)(r, params(p))
type U = Awaited<ReturnType<typeof makeUser>>

const MEDIA = (n: number) => `/api/vip/media/2026-11/${String(n).padStart(8, '0')}-0000-4000-8000-000000000000.jpg`

async function newPost(as: U, body: Record<string, unknown>) {
  setSession(as)
  const res = await call(posts.POST, req('/api/vip/posts', { body }))
  return { res, data: await res.json() }
}
async function feed(as: U, qs = '') {
  setSession(as)
  const d = await (await call(posts.GET, req(`/api/vip/posts${qs}`))).json()
  return [...d.pinned, ...d.posts] as { id: string; author: { id: string }; images: string[]; videoUrl: string | null; editedAt: string | null; bookmarkedByMe: boolean }[]
}
const pointsKey = (k: string) => prisma.loyaltyTransaction.findFirst({ where: { idempotencyKey: k } })

beforeEach(async () => {
  await prisma.siteSetting.deleteMany({ where: { key: { startsWith: 'vip.points.' } } })
})

describe('follow graph', () => {
  let ann: U, ben: U, cat: U, lapsed: U
  beforeAll(async () => {
    ann = await makeUser({ tag: 'fg-ann', tier: 'PLUS', username: 'zz_fg_ann' })
    ben = await makeUser({ tag: 'fg-ben', tier: 'CLUB', username: 'zz_fg_ben' })
    cat = await makeUser({ tag: 'fg-cat', tier: 'PREMIUM', username: 'zz_fg_cat' })
    lapsed = await makeUser({ tag: 'fg-lapsed', tier: 'CLUB', status: 'PAST_DUE' })
  })

  it('follow / unfollow, once only, with one FOLLOW notification', async () => {
    setSession(ann)
    expect((await call(follow.POST, req(`/api/vip/members/${ben.id}/follow`, { method: 'POST' }), { id: ben.id })).status).toBe(200)
    expect((await call(follow.POST, req(`/api/vip/members/${ben.id}/follow`, { method: 'POST' }), { id: ben.id })).status).toBe(200)
    expect(await prisma.vipFollow.count({ where: { followerId: ann.id, followingId: ben.id } })).toBe(1)
    expect(await prisma.vipNotification.count({ where: { userId: ben.id, type: 'FOLLOW', actorId: ann.id } })).toBe(1)

    // unfollow + follow again while the first notification is unread → still one
    await call(follow.DELETE, req(`/api/vip/members/${ben.id}/follow`, { method: 'DELETE' }), { id: ben.id })
    expect(await prisma.vipFollow.count({ where: { followerId: ann.id, followingId: ben.id } })).toBe(0)
    await call(follow.POST, req(`/api/vip/members/${ben.id}/follow`, { method: 'POST' }), { id: ben.id })
    expect(await prisma.vipNotification.count({ where: { userId: ben.id, type: 'FOLLOW', actorId: ann.id } })).toBe(1)
  })

  it('cannot follow yourself or someone without an active membership', async () => {
    setSession(ann)
    expect((await call(follow.POST, req(`/api/vip/members/${ann.id}/follow`, { method: 'POST' }), { id: ann.id })).status).toBe(400)
    expect((await call(follow.POST, req(`/api/vip/members/${lapsed.id}/follow`, { method: 'POST' }), { id: lapsed.id })).status).toBe(404)
  })

  it('Following tab shows only people the viewer follows; lists and counts', async () => {
    const a = await newPost(ben, { body: `ben following-tab ${Math.random()}` })
    const c = await newPost(cat, { body: `cat following-tab ${Math.random()}` })
    const ids = (await feed(ann, '?tab=following')).map((p) => p.id)
    expect(ids).toContain(a.data.id)
    expect(ids).not.toContain(c.data.id)

    setSession(cat)
    const list = await (await call(follows.GET, req(`/api/vip/members/${ben.id}/follows?which=followers`), { id: ben.id })).json()
    expect(list.members.map((m: { id: string }) => m.id)).toEqual([ann.id])
    const viewer = (await loadVipViewer(cat.id))!
    const prof = await loadProfile(viewer, ben.id)
    expect(prof?.stats.followers).toBe(1)
  })

  it('suggests members (never yourself or people you follow)', async () => {
    const viewer = (await loadVipViewer(ann.id))!
    const s = await suggestedMembers(viewer, 20)
    const ids = s.map((m) => m.id)
    expect(ids).not.toContain(ann.id)
    expect(ids).not.toContain(ben.id)
    expect(ids).not.toContain(lapsed.id)
  })
})

describe('profile privacy', () => {
  let priv: U, fan: U, stranger: U, admin: U
  beforeAll(async () => {
    priv = await makeUser({ tag: 'pp-priv', tier: 'PLUS', username: 'zz_pp_priv' })
    fan = await makeUser({ tag: 'pp-fan', tier: 'CLUB' })
    stranger = await makeUser({ tag: 'pp-stranger', tier: 'CLUB' })
    admin = await makeUser({ tag: 'pp-admin', role: 'ADMIN' })
    setSession(priv)
    const res = await call(
      profileApi.PATCH,
      req('/api/vip/profile', {
        method: 'PATCH',
        body: { bio: 'Morning lifter.', location: 'Denver', interests: ['#Strength', 'sleep', 'strength'], profileVisibility: 'FOLLOWERS' },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('saves interests normalised and de-duplicated; rejects bad ones and non-clubhouse images', async () => {
    expect((await prisma.vipInterest.findMany({ where: { userId: priv.id }, orderBy: { tag: 'asc' } })).map((i) => i.tag)).toEqual(['sleep', 'strength'])
    setSession(priv)
    expect((await call(profileApi.PATCH, req('/api/vip/profile', { method: 'PATCH', body: { interests: ['no spaces!'] } }))).status).toBe(400)
    expect((await call(profileApi.PATCH, req('/api/vip/profile', { method: 'PATCH', body: { coverUrl: 'https://evil.example/x.jpg' } }))).status).toBe(400)
    expect((await call(profileApi.PATCH, req('/api/vip/profile', { method: 'PATCH', body: { dmPolicy: 'SOMETIMES' } }))).status).toBe(400)
  })

  it('followers-only: a non-follower sees name and photo only; followers and the team see everything', async () => {
    const asStranger = await loadProfile((await loadVipViewer(stranger.id))!, priv.id)
    expect(asStranger?.full).toBe(false)
    expect(asStranger?.card.bio).toBeNull()
    expect(asStranger?.interests).toEqual([])
    expect(asStranger?.location).toBeNull()
    setSession(stranger)
    expect((await call(follows.GET, req(`/api/vip/members/${priv.id}/follows`), { id: priv.id })).status).toBe(403)

    setSession(fan)
    await call(follow.POST, req(`/api/vip/members/${priv.id}/follow`, { method: 'POST' }), { id: priv.id })
    const asFan = await loadProfile((await loadVipViewer(fan.id))!, priv.id)
    expect(asFan?.full).toBe(true)
    expect(asFan?.card.bio).toBe('Morning lifter.')
    expect(asFan?.interests).toEqual(['sleep', 'strength'])
    expect((await call(follows.GET, req(`/api/vip/members/${priv.id}/follows`), { id: priv.id })).status).toBe(200)

    const asAdmin = await loadProfile((await loadVipViewer(admin.id))!, priv.id)
    expect(asAdmin?.full).toBe(true)
  })

  it('member search finds by interest', async () => {
    setSession(stranger)
    const d = await (await call(members.GET, req('/api/vip/members?q=%23strength'))).json()
    expect(d.members.map((m: { id: string }) => m.id)).toContain(priv.id)
  })

  it('badges are read from VipUserBadge (any feature can grant; one per key)', async () => {
    await prisma.vipUserBadge.create({ data: { userId: priv.id, badgeKey: 'zz-first-week', label: 'First week done' } })
    await expect(prisma.vipUserBadge.create({ data: { userId: priv.id, badgeKey: 'zz-first-week', label: 'again' } })).rejects.toThrow()
    const p = await loadProfile((await loadVipViewer(fan.id))!, priv.id)
    expect(p?.badges.map((b) => b.label)).toEqual(['First week done'])
  })
})

describe('blocks', () => {
  let dee: U, eli: U, fay: U
  let deePost: string
  beforeAll(async () => {
    dee = await makeUser({ tag: 'bl-dee', tier: 'PLUS', username: 'zz_bl_dee' })
    eli = await makeUser({ tag: 'bl-eli', tier: 'CLUB', username: 'zz_bl_eli' })
    fay = await makeUser({ tag: 'bl-fay', tier: 'CLUB' })
    deePost = (await newPost(dee, { body: `dee before block ${Math.random()}` })).data.id
    setSession(eli)
    await call(follow.POST, req(`/api/vip/members/${dee.id}/follow`, { method: 'POST' }), { id: dee.id })
    setSession(dee)
    await call(follow.POST, req(`/api/vip/members/${eli.id}/follow`, { method: 'POST' }), { id: eli.id })
    expect((await call(block.POST, req(`/api/vip/members/${eli.id}/block`, { method: 'POST' }), { id: eli.id })).status).toBe(200)
  })

  it('removes follows both ways', async () => {
    expect(await prisma.vipFollow.count({ where: { OR: [{ followerId: dee.id, followingId: eli.id }, { followerId: eli.id, followingId: dee.id }] } })).toBe(0)
  })

  it('hides posts, threads, comments, profile and search both ways', async () => {
    const eliPost = (await newPost(eli, { body: `eli after block ${Math.random()}` })).data.id
    expect((await feed(eli)).map((p) => p.id)).not.toContain(deePost)
    expect((await feed(dee)).map((p) => p.id)).not.toContain(eliPost)
    expect((await feed(fay)).map((p) => p.id)).toEqual(expect.arrayContaining([deePost, eliPost]))

    setSession(eli)
    expect((await call(post.GET, req(`/api/vip/posts/${deePost}`), { id: deePost })).status).toBe(404)
    expect((await call(comments.POST, req(`/api/vip/posts/${deePost}/comments`, { body: { body: 'hi' } }), { id: deePost })).status).toBe(404)
    expect((await call(follow.POST, req(`/api/vip/members/${dee.id}/follow`, { method: 'POST' }), { id: dee.id })).status).toBe(404)
    const found = await (await call(suggest.GET, req('/api/vip/members/suggest?q=zz_bl'))).json()
    expect(found.members.map((m: { id: string }) => m.id)).not.toContain(dee.id)

    // The blocked member cannot see the blocker's profile at all; the blocker sees an Unblock view.
    expect(await loadProfile((await loadVipViewer(eli.id))!, dee.id)).toBeNull()
    expect((await loadProfile((await loadVipViewer(dee.id))!, eli.id))?.blockedByMe).toBe(true)
  })

  it('a blocked member’s @mention does not notify the blocker', async () => {
    const before = await prisma.vipNotification.count({ where: { userId: dee.id, type: 'MENTION' } })
    await newPost(eli, { body: `hey @zz_bl_dee ${Math.random()}` })
    expect(await prisma.vipNotification.count({ where: { userId: dee.id, type: 'MENTION' } })).toBe(before)
  })

  it('unblock restores visibility (not follows)', async () => {
    setSession(dee)
    await call(block.DELETE, req(`/api/vip/members/${eli.id}/block`, { method: 'DELETE' }), { id: eli.id })
    expect((await feed(eli)).map((p) => p.id)).toContain(deePost)
    expect(await prisma.vipFollow.count({ where: { followerId: eli.id, followingId: dee.id } })).toBe(0)
  })
})

describe('posts: images, video, mentions, hashtags, edit, bookmarks', () => {
  let gus: U, hal: U
  beforeAll(async () => {
    gus = await makeUser({ tag: 'po-gus', tier: 'PLUS', username: 'zz_po_gus' })
    hal = await makeUser({ tag: 'po-hal', tier: 'CLUB', username: 'zz_po_hal' })
  })

  it('up to 6 clubhouse images and a YouTube/Vimeo link', async () => {
    const six = [1, 2, 3, 4, 5, 6].map(MEDIA)
    const ok = await newPost(gus, { body: `six photos ${Math.random()}`, images: six, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    expect(ok.res.status).toBe(201)
    const p = (await feed(hal)).find((x) => x.id === ok.data.id)!
    expect(p.images).toEqual(six)
    expect(p.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect((await prisma.vipPost.findUniqueOrThrow({ where: { id: ok.data.id } })).imageUrl).toBe(six[0])

    expect((await newPost(gus, { body: `seven ${Math.random()}`, images: [...six, MEDIA(7)] })).res.status).toBe(400)
    expect((await newPost(gus, { body: `outside ${Math.random()}`, images: ['https://evil.example/a.jpg'] })).res.status).toBe(400)
    expect((await newPost(gus, { body: `bad video ${Math.random()}`, videoUrl: 'https://evil.example/v.mp4' })).res.status).toBe(400)
  })

  it('@mentions notify; editing notifies only newly added mentions and marks the post edited', async () => {
    const { data } = await newPost(gus, { body: `thanks @zz_po_hal for the plan ${Math.random()}` })
    expect(await prisma.vipNotification.count({ where: { userId: hal.id, type: 'MENTION', postId: data.id } })).toBe(1)

    const third = await makeUser({ tag: 'po-ivy', tier: 'CLUB', username: 'zz_po_ivy' })
    setSession(gus)
    const res = await call(
      post.PATCH,
      req(`/api/vip/posts/${data.id}`, { method: 'PATCH', body: { body: 'thanks @zz_po_hal and @zz_po_ivy #legday' } }),
      { id: data.id },
    )
    expect(res.status).toBe(200)
    expect(await prisma.vipNotification.count({ where: { userId: hal.id, type: 'MENTION', postId: data.id } })).toBe(1)
    expect(await prisma.vipNotification.count({ where: { userId: third.id, type: 'MENTION', postId: data.id } })).toBe(1)
    const p = (await feed(hal)).find((x) => x.id === data.id)!
    expect(p.editedAt).not.toBeNull()
    expect((await prisma.vipPostHashtag.findMany({ where: { postId: data.id } })).map((t) => t.tag)).toEqual(['legday'])

    // someone else's post: 403
    setSession(hal)
    expect((await call(post.PATCH, req(`/api/vip/posts/${data.id}`, { method: 'PATCH', body: { body: 'mine now' } }), { id: data.id })).status).toBe(403)
  })

  it('hashtags: indexed, linked, searchable, trending over 7 days; entities are not tags', async () => {
    expect(extractHashtags("Day 3 #Sleep #sleep #mobility_work it's https://x.example/#anchor")).toEqual(['sleep', 'mobility_work'])
    expect(renderPostBody("it's #recovery", { hashtags: true })).toContain('<a href="/tags/recovery" class="vip-hashtag">#recovery</a>')
    expect(renderPostBody("it's #recovery", { hashtags: true })).not.toContain('/tags/39')
    expect(renderPostBody('#recovery')).not.toContain('/tags/')

    const tag = `zztag${Date.now().toString(36)}`
    const gus = await makeUser({ tag: 'po-gus2', tier: 'PLUS' }) // fresh: posting is rate-limited per member
    const a = await newPost(gus, { body: `first #${tag}` })
    await newPost(hal, { body: `second #${tag} ${Math.random()}` })
    const old = await prisma.vipPost.create({ data: { authorId: hal.id, body: `old #${tag}`, createdAt: new Date(Date.now() - 10 * 864e5) } })
    await prisma.vipPostHashtag.create({ data: { postId: old.id, tag, createdAt: old.createdAt } })

    const tagged = (await feed(gus, `?tag=${tag}`)).map((p) => p.id)
    expect(tagged).toHaveLength(3)
    expect(tagged).toContain(a.data.id)
    const trend = await trendingHashtags({ days: 7, take: 50 })
    expect(trend.find((t) => t.tag === tag)?.count).toBe(2)

    setSession(gus)
    const d = await (await call(discover.GET, req(`/api/vip/discover?q=${tag.slice(0, 8)}`))).json()
    expect(d.tags.map((t: { tag: string }) => t.tag)).toContain(tag)
  })

  it('bookmarks: save, list, unsave; hidden posts cannot be saved', async () => {
    const gus = await makeUser({ tag: 'po-gus3', tier: 'PLUS' })
    const { data } = await newPost(gus, { body: `save me ${Math.random()}` })
    setSession(hal)
    expect((await (await call(bookmarks.POST, req('/api/vip/bookmarks', { body: { postId: data.id } }))).json()).saved).toBe(true)
    expect((await (await call(bookmarks.GET, req('/api/vip/bookmarks'))).json()).posts.map((p: { id: string }) => p.id)).toContain(data.id)
    expect((await feed(hal)).find((p) => p.id === data.id)?.bookmarkedByMe).toBe(true)
    expect((await (await call(bookmarks.POST, req('/api/vip/bookmarks', { body: { postId: data.id } }))).json()).saved).toBe(false)

    const hidden = await prisma.vipPost.create({ data: { authorId: gus.id, body: 'hidden', hiddenAt: new Date() } })
    expect((await call(bookmarks.POST, req('/api/vip/bookmarks', { body: { postId: hidden.id } }))).status).toBe(404)
  })
})

describe('engagement points (shared ledger, exactly once)', () => {
  it('first post 100 once; 10 per posting day once; amounts are settings; 0 = off', async () => {
    const u = await makeUser({ tag: 'pts-jo', tier: 'CLUB' })
    const r1 = await newPost(u, { body: `first ever ${Math.random()}` })
    expect(r1.data.points).toEqual({ firstPost: 100, postDay: 10 })
    const r2 = await newPost(u, { body: `second same day ${Math.random()}` })
    expect(r2.data.points).toEqual({ firstPost: 0, postDay: 0 })
    expect((await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).points).toBe(110)
    expect(await pointsKey(`first-post:${u.id}`)).toMatchObject({ points: 100, type: 'EARN_ENGAGEMENT' })

    // Next day (clubhouse time zone): +10 only. Concurrent repeats award once.
    const tomorrow = new Date(Date.now() + 864e5)
    const runs = await Promise.all([awardPostPoints(u.id, tomorrow), awardPostPoints(u.id, tomorrow), awardPostPoints(u.id, tomorrow)])
    expect(runs.reduce((n, r) => n + r.postDay + r.firstPost, 0)).toBe(10)
    expect(await pointsKey(`post-day:${u.id}:${localDay(tomorrow, 'America/New_York')}`)).not.toBeNull()
    expect((await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).points).toBe(120)

    // Admin sets amounts: 0 turns the daily award off; first-post amount changes for new members.
    const admin = await makeUser({ tag: 'pts-admin', role: 'ADMIN' })
    setSession({ ...admin, role: 'ADMIN' })
    const put = await call(adminSettings.PUT, req('/api/admin/vip/settings', { method: 'PUT', body: { 'vip.points.firstPost': 250, 'vip.points.postDay': 0 } }))
    expect(put.status).toBe(200)
    const v = await makeUser({ tag: 'pts-kim', tier: 'CLUB' })
    expect((await newPost(v, { body: `kim first ${Math.random()}` })).data.points).toEqual({ firstPost: 250, postDay: 0 })
    expect((await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: v.id } })).points).toBe(250)
    setSession({ ...admin, role: 'ADMIN' })
    expect((await call(adminSettings.PUT, req('/api/admin/vip/settings', { method: 'PUT', body: { 'vip.points.postDay': -1 } }))).status).toBe(400)
  })
})

describe('digest includes follows and messages (never message text)', () => {
  it('lists "started following you" and "sent you a message" with clubhouse links', async () => {
    vi.mocked(sendEmail).mockClear()
    const u = await makeUser({ tag: 'dg-lou', tier: 'CLUB' })
    const a = await makeUser({ tag: 'dg-max', tier: 'PLUS' })
    await prisma.vipProfile.create({ data: { userId: a.id, displayName: 'Max Rowe' } })
    await prisma.vipNotification.create({ data: { userId: u.id, type: 'FOLLOW', actorId: a.id } })
    const conv = await prisma.vipConversation.create({
      data: { createdById: a.id, directKey: [a.id, u.id].sort().join(':'), participants: { create: [{ userId: a.id }, { userId: u.id }] } },
    })
    await prisma.vipMessage.create({ data: { conversationId: conv.id, senderId: a.id, body: 'zz secret message text' } })
    await prisma.vipNotification.create({ data: { userId: u.id, type: 'MESSAGE', actorId: a.id, conversationId: conv.id } })

    const t = new Date()
    const due = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 13, 5))
    if (due < t) due.setUTCDate(due.getUTCDate() + 1)
    await runDigest(due, false)
    const mail = vi.mocked(sendEmail).mock.calls.map((c) => c[0]).find((m) => m.to === u.email)!
    expect(mail.subject).toBe('2 new notifications in the Clubhouse')
    expect(mail.html).toContain('started following you')
    expect(mail.html).toContain('sent you a message')
    expect(mail.html).toContain(`/messages/${conv.id}`)
    expect(mail.html).toContain(`/members/${a.id}`)
    expect(mail.html).not.toContain('zz secret message text')
  })
})
