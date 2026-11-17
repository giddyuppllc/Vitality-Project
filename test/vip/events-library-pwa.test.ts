import { beforeAll, describe, expect, it } from 'vitest'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeUser, params, req, setSession } from '../helpers'
import * as rsvp from '@/app/api/vip/events/[id]/rsvp/route'
import * as ics from '@/app/api/vip/events/[id]/ics/route'
import * as adminEvents from '@/app/api/admin/vip/events/route'
import * as adminLibrary from '@/app/api/admin/vip/library/route'
import * as files from '@/app/api/vip/files/[id]/route'
import * as onboarding from '@/app/api/vip/onboarding/route'
import { GET as pwaGET } from '@/app/vip/pwa/[file]/route'
import { listUpcomingEvents } from '@/lib/vip/classroom'
import { runEventReminders } from '@/lib/vip/mailer'
import { searchLibrary } from '@/lib/vip/library'
import { canReadFile, saveAdminFile, sniffKind } from '@/lib/vip/files'
import { eventIcs } from '@/lib/vip/events'
import { loadDashboard } from '@/lib/vip/dashboard'
import { loadVipViewer } from '@/lib/vip/access'
import { VIP_NAV, isActive, visibleNav } from '@/lib/vip/nav'
import { existsSync } from 'node:fs'
import path from 'node:path'

type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => (fn as H)(r, params(p))

let admin: Awaited<ReturnType<typeof makeUser>>
beforeAll(async () => {
  admin = await makeUser({ tag: 'evl-admin', role: 'ADMIN' })
})

const adminPost = async (fn: unknown, url: string, body: Record<string, unknown>) => {
  setSession({ ...admin, role: 'ADMIN' })
  const res = await call(fn, req(url, { body }))
  const json = await res.json()
  if (!res.ok) throw new Error(json.error)
  return json.id as string
}

describe('events: capacity + waitlist', () => {
  it('fills to capacity, waitlists the rest in order, promotes on cancel; reminders only to GOING', async () => {
    const id = await adminPost(adminEvents.POST, '/api/admin/vip/events', {
      op: 'upsert',
      title: 'ZZ capped workshop',
      startsAt: new Date(Date.now() + 20 * 3600e3).toISOString(),
      minTier: 'CLUB',
      published: true,
      kind: 'WORKSHOP',
      capacity: 2,
    })
    const [a, b, c, d] = await Promise.all(['a', 'b', 'c', 'd'].map((t) => makeUser({ tag: `evl-cap-${t}`, tier: 'CLUB' })))
    const go = async (u: { id: string; email: string }) => {
      setSession(u)
      return (await call(rsvp.POST, req(`/api/vip/events/${id}/rsvp`, { method: 'POST' }), { id })).json()
    }
    expect(await go(a)).toEqual({ going: true, count: 1 })
    expect(await go(b)).toEqual({ going: true, count: 2 })
    expect(await go(c)).toEqual({ going: false, count: 2, waitlisted: true, position: 1 })
    expect(await go(d)).toMatchObject({ waitlisted: true, position: 2 })
    expect(await go(c)).toMatchObject({ waitlisted: true, position: 1 }) // idempotent

    const v = (await loadVipViewer(d.id))!
    const view = (await listUpcomingEvents(d.id, v.accessTier)).find((e) => e.id === id)!
    expect(view).toMatchObject({ kind: 'WORKSHOP', capacity: 2, spotsLeft: 0, waitlisted: true, waitlistPosition: 2, going: false })

    const run = await runEventReminders(new Date(), true)
    const mine = await prisma.vipEventRsvp.findMany({ where: { eventId: id } })
    const wouldIds = new Set(run.would.map((w) => w.rsvpId))
    for (const r of mine) expect(wouldIds.has(r.id), r.status ?? '').toBe(r.status !== 'WAITLIST')

    setSession(a)
    expect(await (await call(rsvp.DELETE, req(`/api/vip/events/${id}/rsvp`, { method: 'DELETE' }), { id })).json()).toEqual({ going: false, count: 2 })
    expect((await prisma.vipEventRsvp.findUniqueOrThrow({ where: { eventId_userId: { eventId: id, userId: c.id } } })).status).toBe('GOING')
    expect((await prisma.vipEventRsvp.findUniqueOrThrow({ where: { eventId_userId: { eventId: id, userId: d.id } } })).status).toBe('WAITLIST')

    // raising the capacity seats the waitlist
    await adminPost(adminEvents.POST, '/api/admin/vip/events', {
      op: 'upsert', id, title: 'ZZ capped workshop', startsAt: new Date(Date.now() + 20 * 3600e3).toISOString(), minTier: 'CLUB', published: true, capacity: 5,
    })
    expect((await prisma.vipEventRsvp.findUniqueOrThrow({ where: { eventId_userId: { eventId: id, userId: d.id } } })).status).toBe('GOING')
  })

  it('concurrent RSVPs never exceed capacity', async () => {
    const id = await adminPost(adminEvents.POST, '/api/admin/vip/events', {
      op: 'upsert', title: 'ZZ race', startsAt: new Date(Date.now() + 40 * 3600e3).toISOString(), minTier: 'CLUB', published: true, capacity: 3,
    })
    const users = await Promise.all(Array.from({ length: 8 }, (_, i) => makeUser({ tag: `evl-race-${i}`, tier: 'CLUB' })))
    const { rsvpGoing } = await import('@/lib/vip/events')
    await Promise.all(users.map((u) => rsvpGoing({ id, capacity: 3 }, u.id)))
    expect(await prisma.vipEventRsvp.count({ where: { eventId: id, status: 'GOING' } })).toBe(3)
    expect(await prisma.vipEventRsvp.count({ where: { eventId: id, status: 'WAITLIST' } })).toBe(5)
  })
})

describe('events: .ics and recordings', () => {
  it('.ics is a valid single VEVENT without the join link', async () => {
    const e = await prisma.vipEvent.create({
      data: { title: 'ZZ Q&A, live; with notes', description: 'line one\nline two', startsAt: new Date('2026-12-03T00:00:00Z'), published: true, joinUrl: 'https://meet.example.invalid/secret', kind: 'AMA' },
    })
    const m = await makeUser({ tag: 'evl-ics', tier: 'CLUB' })
    setSession(m)
    const res = await call(ics.GET, req(`/api/vip/events/${e.id}/ics`), { id: e.id })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    const body = await res.text()
    expect(body).toContain('BEGIN:VCALENDAR\r\n')
    expect(body).toContain('DTSTART:20261203T000000Z')
    expect(body).toContain('DTEND:20261203T010000Z')
    expect(body).toContain('SUMMARY:ZZ Q&A\\, live\\; with notes')
    expect(body).not.toContain('meet.example.invalid')
    for (const line of eventIcs(e, 'https://vitalityproject.vip').split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
  })

  it('a recording archives the event into the Library with its tier; removing it withdraws it', async () => {
    const id = await adminPost(adminEvents.POST, '/api/admin/vip/events', {
      op: 'upsert', title: 'ZZ premium roundtable', startsAt: new Date(Date.now() - 48 * 3600e3).toISOString(), minTier: 'PREMIUM', published: true,
    })
    const startsAt = new Date(Date.now() - 48 * 3600e3).toISOString()
    await adminPost(adminEvents.POST, '/api/admin/vip/events', { op: 'upsert', id, title: 'ZZ premium roundtable', startsAt, minTier: 'PREMIUM', published: true, recordingUrl: 'https://video.example.invalid/r1' })
    const res = await prisma.vipResource.findUniqueOrThrow({ where: { eventId: id } })
    expect(res).toMatchObject({ category: 'RECORDINGS', kind: 'RECORDING', minTier: 'PREMIUM', published: true, url: 'https://video.example.invalid/r1' })
    const club = (await searchLibrary({ accessTier: 'CLUB', q: 'roundtable' })).items.find((i) => i.id === res.id)!
    expect(club).toMatchObject({ allowed: false, href: null })
    const prem = (await searchLibrary({ accessTier: 'PREMIUM', q: 'ROUNDTABLE' })).items.find((i) => i.id === res.id)!
    expect(prem.href).toBe('https://video.example.invalid/r1')
    await adminPost(adminEvents.POST, '/api/admin/vip/events', { op: 'upsert', id, title: 'ZZ premium roundtable', startsAt, minTier: 'PREMIUM', published: true, recordingUrl: '' })
    expect((await prisma.vipResource.findUniqueOrThrow({ where: { eventId: id } })).published).toBe(false)
  })
})

describe('library + private files', () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('zz test document\n%%EOF')])

  it('sniffs content, not names', () => {
    expect(sniffKind(pdf)?.ext).toBe('pdf')
    expect(sniffKind(Buffer.from('<html><script>alert(1)</script>'))).toBeNull()
  })

  it('a file is readable only by members who can open an item that uses it', async () => {
    const saved = await saveAdminFile(pdf, 'ZZ Guide.pdf', admin.id)
    if (!saved.ok) throw new Error(saved.error)
    const fileId = saved.file.id
    const club = await makeUser({ tag: 'evl-file-club', tier: 'CLUB' })
    const plus = await makeUser({ tag: 'evl-file-plus', tier: 'PLUS' })
    const cv = (await loadVipViewer(club.id))!
    const pv = (await loadVipViewer(plus.id))!
    expect(await canReadFile(fileId, cv)).toBe(false) // not referenced yet

    const itemId = await adminPost(adminLibrary.POST, '/api/admin/vip/library', {
      op: 'upsert', title: 'ZZ plus guide', category: 'GUIDES', kind: 'PDF', fileId, minTier: 'PLUS', published: true,
    })
    expect(await canReadFile(fileId, cv)).toBe(false)
    expect(await canReadFile(fileId, pv)).toBe(true)

    setSession(club)
    expect((await call(files.GET, req(`/api/vip/files/${fileId}`), { id: fileId })).status).toBe(404)
    setSession(plus)
    const ok = await call(files.GET, req(`/api/vip/files/${fileId}?download=1`), { id: fileId })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('application/pdf')
    expect(ok.headers.get('content-disposition')).toMatch(/^attachment; filename="ZZ Guide\.pdf"/)
    expect(ok.headers.get('cache-control')).toContain('no-store')
    expect(Buffer.from(await ok.arrayBuffer()).equals(pdf)).toBe(true)

    // unpublishing the item closes the file again
    await prisma.vipResource.update({ where: { id: itemId }, data: { published: false } })
    expect(await canReadFile(fileId, pv)).toBe(false)
  })
})

describe('onboarding', () => {
  it('saves answers + prefs, validates choices, and skip records a skip', async () => {
    const m = await makeUser({ tag: 'evl-onb', tier: 'CLUB' })
    setSession(m)
    const bad = await call(onboarding.PUT, req('/api/vip/onboarding', { method: 'PUT', body: { interests: ['nope'], goals: [], emailDigest: true, emailEvents: true, emailRewards: true } }))
    expect(bad.status).toBe(400)
    const tooMany = await call(onboarding.PUT, req('/api/vip/onboarding', { method: 'PUT', body: { interests: [], goals: ['strength', 'energy', 'sleep', 'habits'], emailDigest: true, emailEvents: true, emailRewards: true } }))
    expect(tooMany.status).toBe(400)
    const ok = await call(onboarding.PUT, req('/api/vip/onboarding', {
      method: 'PUT',
      body: { displayName: 'ZZ Onboarded', bio: 'zz', interests: ['training', 'sleep'], goals: ['strength'], trackId: null, emailDigest: false, emailEvents: true, emailRewards: false },
    }))
    expect(ok.status).toBe(200)
    const row = await prisma.vipOnboarding.findUniqueOrThrow({ where: { userId: m.id } })
    expect(row).toMatchObject({ interests: ['training', 'sleep'], goals: ['strength'] })
    expect(row.completedAt).not.toBeNull()
    expect(await prisma.vipProfile.findUniqueOrThrow({ where: { userId: m.id } })).toMatchObject({ displayName: 'ZZ Onboarded', emailDigest: false, emailRewards: false })

    const s = await makeUser({ tag: 'evl-onb-skip', tier: 'CLUB' })
    setSession(s)
    await call(onboarding.PUT, req('/api/vip/onboarding', { method: 'PUT', body: { skip: true } }))
    expect((await prisma.vipOnboarding.findUniqueOrThrow({ where: { userId: s.id } })).skippedAt).not.toBeNull()
  })

  it('a community-suspended member cannot change their public name through onboarding', async () => {
    const m = await makeUser({ tag: 'evl-onb-susp', tier: 'CLUB', suspended: true })
    setSession(m)
    await call(onboarding.PUT, req('/api/vip/onboarding', { method: 'PUT', body: { displayName: 'ZZ new name', interests: [], goals: [], emailDigest: true, emailEvents: true, emailRewards: true } }))
    expect((await prisma.vipProfile.findUniqueOrThrow({ where: { userId: m.id } })).displayName).toBeNull()
  })
})

describe('dashboard + nav', () => {
  it('loads every section for a new member and asks for onboarding', async () => {
    const m = await makeUser({ tag: 'evl-dash', tier: 'PLUS' })
    const v = (await loadVipViewer(m.id))!
    const d = await loadDashboard(v)
    expect(d.needsOnboarding).toBe(true)
    expect(d.points).toBe(0)
    expect(Array.isArray(d.events)).toBe(true)
  })

  it('nav: exactly five tabs; every href is a real clubhouse page; suspended members lose community items', () => {
    expect(VIP_NAV.filter((n) => n.tab).map((n) => n.href)).toEqual(['/dashboard', '/feed', '/classroom', '/fitness', '/rewards'])
    expect(VIP_NAV.filter((n) => n.tab).map((n) => n.label)).toEqual(['Home', 'Community', 'Learn', 'Fitness', 'Rewards'])
    for (const href of ['/messages', '/discover', '/saved', '/events', '/library', '/rewards/partners', '/members', '/profile', '/settings']) {
      expect(VIP_NAV.some((n) => n.href === href), href).toBe(true)
    }
    // Every nav href has a page under src/app/vip/(club) — no links to routes that don't exist.
    const club = path.resolve(__dirname, '../../src/app/vip/(club)')
    for (const n of VIP_NAV) expect(existsSync(path.join(club, n.href, 'page.tsx')), n.href).toBe(true)
    // Mobile labels fit a 390px bar (6 columns ≈ 65px; 10.5px type ≈ 6px/char).
    for (const n of VIP_NAV.filter((x) => x.tab)) expect(n.label.length, n.label).toBeLessThanOrEqual(9)
    const s = visibleNav({ suspended: true }).map((n) => n.href)
    for (const gone of ['/feed', '/members', '/messages', '/discover', '/saved']) expect(s).not.toContain(gone)
    expect(new Set(VIP_NAV.map((n) => n.key)).size).toBe(VIP_NAV.length)
    // /rewards/partners lights Partners, not Rewards.
    const rewards = VIP_NAV.find((n) => n.key === 'rewards')!
    const partners = VIP_NAV.find((n) => n.key === 'partners')!
    expect(isActive(rewards, '/rewards/partners')).toBe(false)
    expect(isActive(partners, '/rewards/partners')).toBe(true)
    expect(isActive(rewards, '/rewards/catalog')).toBe(true)
  })
})

describe('PWA (clubhouse only)', () => {
  it('serves a scoped manifest, monogram icons and the worker', async () => {
    const r = (f: string) => pwaGET(req(`/vip/pwa/${f}`), { params: Promise.resolve({ file: f }) })
    const m = await (await r('manifest.webmanifest')).json()
    expect(m).toMatchObject({ scope: '/', start_url: '/dashboard', display: 'standalone', theme_color: '#070b14' })
    expect(m.icons.map((i: { src: string }) => i.src)).toEqual(['/app-icon-192.png', '/app-icon-512.png', '/app-icon-maskable-512.png'])
    const icon = await r('app-icon-192.png')
    expect(icon.headers.get('content-type')).toBe('image/png')
    const png = Buffer.from(await icon.arrayBuffer())
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(192)
    const sw = await (await r('clubhouse-sw.js')).text()
    expect(sw).toContain("const OFFLINE = '/offline'")
    expect(sw).not.toMatch(/api\/vip|cache\.put/) // never caches member content
    expect((await r('manifest.json')).status).toBe(404)
  })
})
