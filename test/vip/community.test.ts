import { beforeAll, describe, expect, it } from 'vitest'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeUser, params, req, setSession } from '../helpers'
import * as posts from '@/app/api/vip/posts/route'
import * as post from '@/app/api/vip/posts/[id]/route'
import * as comments from '@/app/api/vip/posts/[id]/comments/route'
import * as reactions from '@/app/api/vip/reactions/route'
import * as reports from '@/app/api/vip/reports/route'
import * as members from '@/app/api/vip/members/route'
import * as moderation from '@/app/api/admin/vip/moderation/route'
import * as spaces from '@/app/api/admin/vip/spaces/route'
import { renderPostBody, renderLessonMarkdown, extractMentions } from '@/lib/vip/text'

type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => (fn as H)(r, params(p))

let alice: Awaited<ReturnType<typeof makeUser>>
let bob: Awaited<ReturnType<typeof makeUser>>
let carol: Awaited<ReturnType<typeof makeUser>>
let admin: Awaited<ReturnType<typeof makeUser>>

beforeAll(async () => {
  alice = await makeUser({ tag: 'alice', tier: 'PLUS', username: 'zz_alice' })
  bob = await makeUser({ tag: 'bob', tier: 'CLUB', username: 'zz_bob' })
  carol = await makeUser({ tag: 'carol', tier: 'PREMIUM', username: 'zz_carol' })
  admin = await makeUser({ tag: 'admin', role: 'ADMIN' })
})

async function createPost(as: { id: string; email: string; role?: string }, body: Record<string, unknown>) {
  setSession(as)
  const res = await call(posts.POST, req('/api/vip/posts', { body }))
  return { res, data: await res.json() }
}

async function feedIds() {
  const res = await call(posts.GET, req('/api/vip/posts'))
  const d = await res.json()
  return [...d.pinned, ...d.posts].map((p: { id: string }) => p.id)
}

describe('posts, comments, reactions, reports, moderation', () => {
  let postId: string

  it('member creates a post; it appears in the feed', async () => {
    const { res, data } = await createPost(alice, { body: 'Hello clubhouse, @zz_carol say hi' })
    expect(res.status).toBe(201)
    postId = data.id
    setSession(bob)
    expect(await feedIds()).toContain(postId)
    // mention notified carol (a member), not alice herself
    expect(await prisma.vipNotification.count({ where: { userId: carol.id, type: 'MENTION', postId } })).toBe(1)
  })

  it('comment + one-level reply, with notifications', async () => {
    setSession(bob)
    const c1 = await call(comments.POST, req(`/api/vip/posts/${postId}/comments`, { body: { body: 'Nice one' } }), { id: postId })
    expect(c1.status).toBe(201)
    const top = (await c1.json()).id
    expect(await prisma.vipNotification.count({ where: { userId: alice.id, type: 'COMMENT', postId } })).toBe(1)

    setSession(carol)
    const r1 = await call(comments.POST, req(`/api/vip/posts/${postId}/comments`, { body: { body: 'Agreed', parentId: top } }), { id: postId })
    const reply = await r1.json()
    expect(reply.parentId).toBe(top)
    expect(await prisma.vipNotification.count({ where: { userId: bob.id, type: 'REPLY' } })).toBe(1)

    // replying to a reply flattens onto the top-level comment
    setSession(alice)
    const r2 = await call(comments.POST, req(`/api/vip/posts/${postId}/comments`, { body: { body: 'Me too', parentId: reply.id } }), { id: postId })
    expect((await r2.json()).parentId).toBe(top)

    const thread = await (await call(post.GET, req(`/api/vip/posts/${postId}`), { id: postId })).json()
    expect(thread.comments).toHaveLength(1)
    expect(thread.comments[0].replies).toHaveLength(2)
  })

  it('like toggles on and off', async () => {
    setSession(bob)
    const on = await (await call(reactions.POST, req('/api/vip/reactions', { body: { postId } }))).json()
    expect(on).toEqual({ liked: true, count: 1 })
    const off = await (await call(reactions.POST, req('/api/vip/reactions', { body: { postId } }))).json()
    expect(off).toEqual({ liked: false, count: 0 })
  })

  it('report goes to the admin queue once per member', async () => {
    setSession(bob)
    const r = await call(reports.POST, req('/api/vip/reports', { body: { postId, reason: 'Off topic' } }))
    expect(r.status).toBe(201)
    const again = await (await call(reports.POST, req('/api/vip/reports', { body: { postId, reason: 'Off topic' } }))).json()
    expect(again.duplicate).toBe(true)
    expect(await prisma.vipReport.count({ where: { postId, status: 'OPEN' } })).toBe(1)
  })

  it('admin hide → gone for members (feed, thread, reactions, comments); restore → back', async () => {
    setSession(admin)
    expect((await call(moderation.POST, req('/api/admin/vip/moderation', { body: { action: 'hide_post', postId, reason: 'test' } }))).status).toBe(200)

    setSession(bob)
    expect(await feedIds()).not.toContain(postId)
    expect((await call(post.GET, req(`/api/vip/posts/${postId}`), { id: postId })).status).toBe(404)
    expect((await call(reactions.POST, req('/api/vip/reactions', { body: { postId } }))).status).toBe(404)
    expect((await call(comments.POST, req(`/api/vip/posts/${postId}/comments`, { body: { body: 'still here?' } }), { id: postId })).status).toBe(404)

    setSession(admin)
    await call(moderation.POST, req('/api/admin/vip/moderation', { body: { action: 'restore_post', postId } }))
    const report = await prisma.vipReport.findFirstOrThrow({ where: { postId } })
    await call(moderation.POST, req('/api/admin/vip/moderation', { body: { action: 'resolve_report', reportId: report.id } }))
    expect((await prisma.vipReport.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('RESOLVED')

    setSession(bob)
    expect(await feedIds()).toContain(postId)
  })

  it('hidden comment disappears for members', async () => {
    const c = await prisma.vipComment.findFirstOrThrow({ where: { postId, parentId: null } })
    setSession(admin)
    await call(moderation.POST, req('/api/admin/vip/moderation', { body: { action: 'hide_comment', commentId: c.id } }))
    setSession(bob)
    const thread = await (await call(post.GET, req(`/api/vip/posts/${postId}`), { id: postId })).json()
    expect(thread.comments.find((x: { id: string }) => x.id === c.id)).toBeUndefined()
  })

  it('pin puts a post first; suspend removes the member from the community', async () => {
    setSession(admin)
    await call(moderation.POST, req('/api/admin/vip/moderation', { body: { action: 'pin_post', postId } }))
    await createPost(carol, { body: 'a newer post' })
    setSession(bob)
    const d = await (await call(posts.GET, req('/api/vip/posts'))).json()
    expect(d.pinned.map((p: { id: string }) => p.id)).toContain(postId)

    setSession(admin)
    await call(moderation.POST, req('/api/admin/vip/moderation', { body: { action: 'suspend_member', userId: carol.id } }))
    setSession(carol)
    expect((await call(posts.GET, req('/api/vip/posts'))).status).toBe(403)
    setSession(bob)
    const dir = await (await call(members.GET, req('/api/vip/members'))).json()
    expect(dir.members.map((m: { id: string }) => m.id)).not.toContain(carol.id)
    setSession(admin)
    await call(moderation.POST, req('/api/admin/vip/moderation', { body: { action: 'unsuspend_member', userId: carol.id } }))
    setSession(carol)
    expect((await call(posts.GET, req('/api/vip/posts'))).status).toBe(200)
  })

  it('only the author edits/deletes their post', async () => {
    const { data } = await createPost(alice, { body: 'mine to delete' })
    setSession(bob)
    expect((await call(post.DELETE, req(`/api/vip/posts/${data.id}`, { method: 'DELETE' }), { id: data.id })).status).toBe(403)
    setSession(alice)
    expect((await call(post.DELETE, req(`/api/vip/posts/${data.id}`, { method: 'DELETE' }), { id: data.id })).status).toBe(200)
  })
})

describe('spam guard + rate limits + input rules', () => {
  it('rejects duplicates, empty, too many links, foreign image URLs', async () => {
    const u = await makeUser({ tag: 'spam', tier: 'CLUB' })
    expect((await createPost(u, { body: 'same text twice' })).res.status).toBe(201)
    expect((await createPost(u, { body: 'same text twice' })).res.status).toBe(422)
    expect((await createPost(u, { body: '   ' })).res.status).toBe(422)
    const links = Array.from({ length: 6 }, (_, i) => `https://example.invalid/${i}`).join(' ')
    expect((await createPost(u, { body: links })).res.status).toBe(422)
    expect((await createPost(u, { body: 'img', imageUrl: 'https://tracker.example/pixel.gif' })).res.status).toBe(400)
  })

  it('rate-limits posting (6th post in 10 minutes → 429)', async () => {
    const u = await makeUser({ tag: 'rate', tier: 'CLUB' })
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await createPost(u, { body: `rate post ${i}` })).res.status)
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true)
    expect(statuses[5]).toBe(429)
  })

  it('admin-only spaces and announcements are admin-only', async () => {
    setSession(admin)
    const sp = await (await call(spaces.POST, req('/api/admin/vip/spaces', { body: { name: `ZZ Announcements ${Date.now()}`, adminOnly: true } }))).json()
    const u = await makeUser({ tag: 'space', tier: 'PLUS' })
    expect((await createPost(u, { body: 'into the admin space', spaceId: sp.space.id })).res.status).toBe(403)
    const { data } = await createPost(u, { body: 'trying to announce', isAnnouncement: true })
    expect((await prisma.vipPost.findUniqueOrThrow({ where: { id: data.id } })).isAnnouncement).toBe(false)
    const adm = await createPost(admin, { body: 'team announcement', spaceId: sp.space.id, isAnnouncement: true })
    expect(adm.res.status).toBe(201)
    expect((await prisma.vipPost.findUniqueOrThrow({ where: { id: adm.data.id } })).isAnnouncement).toBe(true)
  })
})

describe('safe rendering', () => {
  it('escapes HTML and only links http(s)', () => {
    const html = renderPostBody('<script>alert(1)</script> javascript:alert(1) https://ok.example/a?b=1&c=2 @zz_bob')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toMatch(/href="javascript:/)
    expect(html).toContain('href="https://ok.example/a?b=1&amp;c=2"')
    expect(html).toContain('rel="nofollow noopener noreferrer ugc"')
    expect(html).toContain('href="/members/@zz_bob"')
    // a mention inside a URL must not inject markup into the href
    expect(renderPostBody('https://x.example/@zz_bob')).not.toContain('vip-mention')
  })

  it('lesson markdown escapes raw HTML', () => {
    const html = renderLessonMarkdown('# Title\n\n<img src=x onerror=alert(1)>\n\n- **a**\n- [l](javascript:alert(1))')
    expect(html).toContain('<h2>Title</h2>')
    expect(html).not.toContain('<img')
    expect(html).not.toMatch(/href="javascript:/)
    expect(html).toContain('<strong>a</strong>')
  })

  it('extracts at most 10 unique mentions', () => {
    expect(extractMentions('@a1 @a1 @b2')).toEqual(['a1', 'b2'])
    expect(extractMentions(Array.from({ length: 20 }, (_, i) => `@user${i}`).join(' '))).toHaveLength(10)
  })
})
