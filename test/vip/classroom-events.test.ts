import { beforeAll, describe, expect, it } from 'vitest'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeUser, params, req, setSession } from '../helpers'
import * as progress from '@/app/api/vip/lessons/[id]/progress/route'
import * as rsvp from '@/app/api/vip/events/[id]/rsvp/route'
import * as adminClassroom from '@/app/api/admin/vip/classroom/route'
import { getCourse, getLesson, listCourses, listUpcomingEvents } from '@/lib/vip/classroom'
import { loadVipViewer, tierAllows } from '@/lib/vip/access'

type H = (r: NextRequest, c: { params: Promise<Record<string, unknown>> }) => Promise<Response>
const call = (fn: unknown, r: NextRequest, p: Record<string, unknown> = {}) => (fn as H)(r, params(p))

let club: Awaited<ReturnType<typeof makeUser>>
let plus: Awaited<ReturnType<typeof makeUser>>
let premium: Awaited<ReturnType<typeof makeUser>>
let admin: Awaited<ReturnType<typeof makeUser>>
let ids: { course: string; slug: string; open: string; plusOnly: string; draft: string; premiumEvent: string; clubEvent: string }

beforeAll(async () => {
  club = await makeUser({ tag: 'cls-club', tier: 'CLUB' })
  plus = await makeUser({ tag: 'cls-plus', tier: 'PLUS' })
  premium = await makeUser({ tag: 'cls-premium', tier: 'PREMIUM' })
  admin = await makeUser({ tag: 'cls-admin', role: 'ADMIN' })

  // Built through the admin API (fake placeholder content only).
  setSession(admin)
  const post = async (body: Record<string, unknown>) =>
    (await (await call(adminClassroom.POST, req('/api/admin/vip/classroom', { body }))).json()).id as string
  const slug = `zz-test-course-${Date.now()}`
  const course = await post({ op: 'course.upsert', title: 'ZZ Test Course', slug, minTier: 'CLUB', published: true })
  const mod = await post({ op: 'module.upsert', courseId: course, title: 'ZZ Module' })
  const open = await post({ op: 'lesson.upsert', moduleId: mod, title: 'ZZ open', body: 'placeholder', minTier: null, published: true })
  const plusOnly = await post({ op: 'lesson.upsert', moduleId: mod, title: 'ZZ plus', body: 'placeholder', minTier: 'PLUS', published: true })
  const draft = await post({ op: 'lesson.upsert', moduleId: mod, title: 'ZZ draft', body: 'placeholder', minTier: null, published: false })
  const now = Date.now()
  const premiumEvent = (
    await prisma.vipEvent.create({
      data: { title: 'ZZ premium Q&A', startsAt: new Date(now + 86400e3), minTier: 'PREMIUM', published: true, joinUrl: 'https://meet.example.invalid/p' },
    })
  ).id
  const clubEvent = (
    await prisma.vipEvent.create({
      data: { title: 'ZZ club Q&A', startsAt: new Date(now + 2 * 86400e3), minTier: 'CLUB', published: true, joinUrl: 'https://meet.example.invalid/c' },
    })
  ).id
  await prisma.vipEvent.create({ data: { title: 'ZZ unpublished', startsAt: new Date(now + 86400e3), published: false } })
  ids = { course, slug, open, plusOnly, draft, premiumEvent, clubEvent }
})

describe('tier-gated lessons', () => {
  it('tierAllows orders CLUB < PLUS < PREMIUM and NONE never passes', () => {
    expect(tierAllows('CLUB', 'CLUB')).toBe(true)
    expect(tierAllows('CLUB', 'PLUS')).toBe(false)
    expect(tierAllows('PREMIUM', 'PLUS')).toBe(true)
    expect(tierAllows('NONE', 'CLUB')).toBe(false)
  })

  it('CLUB member: open lesson yes, PLUS lesson no (content withheld), draft invisible', async () => {
    const v = (await loadVipViewer(club.id))!
    const open = await getLesson(ids.open, club.id, v.accessTier)
    expect(open?.allowed).toBe(true)
    const locked = await getLesson(ids.plusOnly, club.id, v.accessTier)
    expect(locked?.allowed).toBe(false)
    expect(await getLesson(ids.draft, club.id, v.accessTier)).toBeNull()

    const course = await getCourse(ids.slug, club.id, v.accessTier)
    const lessons = course!.modules.flatMap((m) => m.lessons)
    expect(lessons.map((l) => l.id)).not.toContain(ids.draft)
    expect(lessons.find((l) => l.id === ids.plusOnly)?.allowed).toBe(false)

    setSession(club)
    expect((await call(progress.POST, req(`/api/vip/lessons/${ids.plusOnly}/progress`, { method: 'POST' }), { id: ids.plusOnly })).status).toBe(403)
    expect((await call(progress.POST, req(`/api/vip/lessons/${ids.draft}/progress`, { method: 'POST' }), { id: ids.draft })).status).toBe(404)
    expect((await call(progress.POST, req(`/api/vip/lessons/${ids.open}/progress`, { method: 'POST' }), { id: ids.open })).status).toBe(200)
  })

  it('progress is tracked per member', async () => {
    setSession(plus)
    expect((await call(progress.POST, req(`/api/vip/lessons/${ids.plusOnly}/progress`, { method: 'POST' }), { id: ids.plusOnly })).status).toBe(200)
    // idempotent
    expect((await call(progress.POST, req(`/api/vip/lessons/${ids.plusOnly}/progress`, { method: 'POST' }), { id: ids.plusOnly })).status).toBe(200)
    const pv = (await loadVipViewer(plus.id))!
    const listed = (await listCourses(plus.id, pv.accessTier)).find((c) => c.id === ids.course)!
    expect(listed.completedCount).toBe(1)
    expect(listed.lessonCount).toBe(2) // draft excluded
    const cv = (await loadVipViewer(club.id))!
    expect((await listCourses(club.id, cv.accessTier)).find((c) => c.id === ids.course)!.completedCount).toBe(1)
  })

  it('unpublishing a course hides it entirely', async () => {
    await prisma.vipCourse.update({ where: { id: ids.course }, data: { published: false } })
    const v = (await loadVipViewer(premium.id))!
    expect(await getCourse(ids.slug, premium.id, v.accessTier)).toBeNull()
    expect(await getLesson(ids.open, premium.id, v.accessTier)).toBeNull()
    await prisma.vipCourse.update({ where: { id: ids.course }, data: { published: true } })
  })
})

describe('tier-gated events + RSVP', () => {
  it('below-tier members see the event but never its join link, and cannot RSVP', async () => {
    const v = (await loadVipViewer(plus.id))!
    const events = await listUpcomingEvents(plus.id, v.accessTier)
    const prem = events.find((e) => e.id === ids.premiumEvent)!
    expect(prem.allowed).toBe(false)
    expect(prem.joinUrl).toBeNull()
    expect(events.find((e) => e.title === 'ZZ unpublished')).toBeUndefined()
    setSession(plus)
    expect((await call(rsvp.POST, req(`/api/vip/events/${ids.premiumEvent}/rsvp`, { method: 'POST' }), { id: ids.premiumEvent })).status).toBe(403)
  })

  it('eligible member RSVPs once, can un-RSVP', async () => {
    setSession(premium)
    const a = await (await call(rsvp.POST, req(`/api/vip/events/${ids.premiumEvent}/rsvp`, { method: 'POST' }), { id: ids.premiumEvent })).json()
    const b = await (await call(rsvp.POST, req(`/api/vip/events/${ids.premiumEvent}/rsvp`, { method: 'POST' }), { id: ids.premiumEvent })).json()
    expect(a).toEqual({ going: true, count: 1 })
    expect(b).toEqual({ going: true, count: 1 })
    const v = (await loadVipViewer(premium.id))!
    const ev = (await listUpcomingEvents(premium.id, v.accessTier)).find((e) => e.id === ids.premiumEvent)!
    expect(ev.joinUrl).toBe('https://meet.example.invalid/p')
    expect(ev.going).toBe(true)
    const c = await (await call(rsvp.DELETE, req(`/api/vip/events/${ids.premiumEvent}/rsvp`, { method: 'DELETE' }), { id: ids.premiumEvent })).json()
    expect(c).toEqual({ going: false, count: 0 })
  })

  it('cancelled events disappear and refuse RSVPs', async () => {
    await prisma.vipEvent.update({ where: { id: ids.clubEvent }, data: { cancelledAt: new Date() } })
    setSession(club)
    expect((await call(rsvp.POST, req(`/api/vip/events/${ids.clubEvent}/rsvp`, { method: 'POST' }), { id: ids.clubEvent })).status).toBe(404)
  })
})
