import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { POST as markPaidPOST } from '@/app/api/admin/orders/[id]/mark-paid/route'
import * as prefsApi from '@/app/api/vip/email-prefs/route'
import { GET as notifyGET } from '@/app/api/cron/vip-notify/route'
import { ensureEventSeries, runDigest, runEventReminders, sendClubhouseWelcome } from '@/lib/vip/mailer'
import { prefLink, signPrefToken, verifyPrefToken } from '@/lib/vip/email-prefs'
import { nextMonthlyOccurrence, zonedTimeToUtc } from '@/lib/vip/time'
import { makeUser, params, req, setSession } from '../helpers'

/**
 * Clubhouse emails go through .global's sendEmail (mocked in test/setup.ts —
 * nothing is ever sent from tests). Every flow sends at most once.
 */
const sent = () => vi.mocked(sendEmail).mock.calls.map((c) => c[0])
const sentTo = (email: string) => sent().filter((c) => c.to === email)

beforeEach(async () => {
  vi.mocked(sendEmail).mockClear()
  await prisma.siteSetting.deleteMany({ where: { key: { startsWith: 'vip.' } } })
})

describe('welcome to the clubhouse', () => {
  it('is sent once when a membership invoice is marked paid (the hand-off back to .vip)', async () => {
    const u = await makeUser({ tag: 'em-welcome' })
    const membership = await prisma.membership.create({ data: { userId: u.id, tier: 'PLUS', status: 'PENDING_PAYMENT' } })
    const order = await prisma.order.create({
      data: {
        orderNumber: `ZZ-${Date.now()}`,
        userId: u.id,
        email: u.email,
        subtotal: 15000,
        total: 15000,
        paymentMethod: 'zelle',
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        notes: `MEMBERSHIP:${membership.id}:PLUS`,
      },
    })
    const admin = await makeUser({ tag: 'em-admin', role: 'ADMIN' })
    setSession({ ...admin, role: 'ADMIN' })
    const res = await markPaidPOST(req(`/api/admin/orders/${order.id}/mark-paid`, { method: 'POST' }), params({ id: order.id }))
    expect(res.status).toBe(200)
    await vi.waitFor(() => expect(sentTo(u.email).some((m) => m.subject.startsWith('Welcome to the Clubhouse'))).toBe(true))
    const welcome = sentTo(u.email).find((m) => m.subject.startsWith('Welcome to the Clubhouse'))!
    expect(welcome.replyTo).toBe('vital@vitalityproject.global')
    expect(welcome.html).toContain('https://vitalityproject.vip/feed')
    expect(welcome.html).toContain('Plus membership is active')
    expect(await sendClubhouseWelcome(u.id)).toBe('already')
    expect(sentTo(u.email).filter((m) => m.subject.startsWith('Welcome to the Clubhouse'))).toHaveLength(1)
  })

  it('is held (not sent, not claimed) while vitalityproject.vip has no DNS, and goes out on the next trigger once it does', async () => {
    const live = (globalThis as unknown as { __vipDomainLive: { value: boolean } }).__vipDomainLive
    const u = await makeUser({ tag: 'em-held', tier: 'PLUS' })
    try {
      live.value = false
      expect(await sendClubhouseWelcome(u.id)).toBe('failed')
      expect(sentTo(u.email)).toHaveLength(0)
      expect((await prisma.vipProfile.findUnique({ where: { userId: u.id } }))?.welcomeEmailAt ?? null).toBeNull()
      live.value = true
      expect(await sendClubhouseWelcome(u.id)).toBe('sent')
      expect(sentTo(u.email)).toHaveLength(1)
    } finally {
      live.value = true
    }
  })

  it('never goes to someone without an active membership', async () => {
    const u = await makeUser({ tag: 'em-nomember', tier: 'CLUB', status: 'PAST_DUE' })
    expect(await sendClubhouseWelcome(u.id)).toBe('not_member')
    expect(sentTo(u.email)).toHaveLength(0)
  })

  it('reply-to follows the admin setting', async () => {
    await prisma.siteSetting.create({ data: { key: 'vip.emailReplyTo', value: 'zz-coach@example.invalid' } })
    const u = await makeUser({ tag: 'em-replyto', tier: 'CLUB' })
    expect(await sendClubhouseWelcome(u.id)).toBe('sent')
    expect(sentTo(u.email)[0].replyTo).toBe('zz-coach@example.invalid')
  })
})

describe('daily reply/mention digest', () => {
  async function setup(tag: string, profile: Record<string, unknown> = {}) {
    const u = await makeUser({ tag, tier: 'CLUB' })
    const actor = await makeUser({ tag: `${tag}-actor`, tier: 'PLUS' })
    await prisma.vipProfile.create({ data: { userId: actor.id, displayName: 'Coach Casey' } })
    if (Object.keys(profile).length) await prisma.vipProfile.create({ data: { userId: u.id, ...profile } })
    const post = await prisma.vipPost.create({ data: { authorId: u.id, body: 'Week 3 of the reset: sleep average up to 7h40.' } })
    const c = await prisma.vipComment.create({ data: { postId: post.id, authorId: actor.id, body: 'Huge. What changed in your wind-down?' } })
    await prisma.vipNotification.create({ data: { userId: u.id, type: 'COMMENT', actorId: actor.id, postId: post.id, commentId: c.id } })
    return u
  }
  const at = (h: number) => new Date(Date.UTC(2026, 8, 29, h, 5))
  // The next 13:05 UTC (digest hour) at or after the real clock: the test
  // notifications are stamped with the real time, so the run must not be earlier.
  const nextDigestRun = () => {
    const t = new Date()
    const due = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 13, 5))
    if (due < t) due.setUTCDate(due.getUTCDate() + 1)
    return due
  }

  it('waits for the digest hour, sends once per day, then again the next day only for new activity', async () => {
    const u = await setup('em-dg')
    expect((await runDigest(at(10), false)).skipped).toBe('before_digest_hour')
    expect(sentTo(u.email)).toHaveLength(0)

    const due = nextDigestRun()
    expect((await runDigest(due, false)).skipped).toBeUndefined()
    const mail = sentTo(u.email)
    expect(mail).toHaveLength(1)
    expect(mail[0].subject).toBe('Coach Casey commented on your post in the Clubhouse')
    expect(mail[0].html).toContain('What changed in your wind-down?')
    expect(mail[0].replyTo).toBe('vital@vitalityproject.global')

    await runDigest(new Date(due.getTime() + 3600e3), false)
    expect(sentTo(u.email)).toHaveLength(1)
  })

  it('respects the member opt-out, community suspension and the store-wide marketing opt-out', async () => {
    const off = await setup('em-dg-off', { emailDigest: false })
    const susp = await setup('em-dg-susp', { suspendedAt: new Date() })
    const mkt = await setup('em-dg-mkt')
    await prisma.communicationPreference.create({ data: { userId: mkt.id, marketingEmail: false } })
    const ran = await runDigest(nextDigestRun(), false)
    expect(ran.skipped).toBeUndefined()
    for (const u of [off, susp, mkt]) expect(sentTo(u.email)).toHaveLength(0)
  })
})

describe('event reminders (24h + 1h, RSVPs only)', () => {
  async function event(startsInMin: number, minTier: 'CLUB' | 'PLUS' | 'PREMIUM' = 'CLUB') {
    return prisma.vipEvent.create({
      data: { title: `ZZ Live Q&A ${Math.random().toString(36).slice(2, 6)}`, description: 'Bring your questions.', startsAt: new Date(Date.now() + startsInMin * 60000), published: true, minTier, joinUrl: 'https://example.invalid/zz' },
    })
  }

  it('24h then 1h, each once; a late RSVP gets only the 1h reminder', async () => {
    const u = await makeUser({ tag: 'em-ev', tier: 'PLUS' })
    const late = await makeUser({ tag: 'em-ev-late', tier: 'PLUS' })
    const e = await event(20 * 60)
    await prisma.vipEventRsvp.create({ data: { eventId: e.id, userId: u.id } })
    await runEventReminders(new Date(), false)
    await runEventReminders(new Date(), false)
    expect(sentTo(u.email).map((m) => m.subject)).toEqual([`Tomorrow: ${e.title}`])
    expect(sentTo(u.email)[0].html).not.toContain('example.invalid/zz') // join link stays in the clubhouse

    await prisma.vipEventRsvp.create({ data: { eventId: e.id, userId: late.id } })
    const oneHourOut = new Date(e.startsAt.getTime() - 50 * 60000)
    await runEventReminders(oneHourOut, false)
    await runEventReminders(oneHourOut, false)
    expect(sentTo(u.email).map((m) => m.subject)).toEqual([`Tomorrow: ${e.title}`, `Starting in an hour: ${e.title}`])
    expect(sentTo(late.email).map((m) => m.subject)).toEqual([`Starting in an hour: ${e.title}`])
  })

  it('overlapping cron runs send each reminder once (the claim is the guard)', async () => {
    const u = await makeUser({ tag: 'em-ev-race', tier: 'PLUS' })
    const e = await event(10 * 60)
    await prisma.vipEventRsvp.create({ data: { eventId: e.id, userId: u.id } })
    const now = new Date()
    await Promise.all([runEventReminders(now, false), runEventReminders(now, false), runEventReminders(now, false)])
    expect(sentTo(u.email)).toHaveLength(1)
  })

  it('skips members whose tier the event excludes and members who turned reminders off', async () => {
    const club = await makeUser({ tag: 'em-ev-club', tier: 'CLUB' })
    const off = await makeUser({ tag: 'em-ev-off', tier: 'PREMIUM' })
    await prisma.vipProfile.create({ data: { userId: off.id, emailEvents: false } })
    const e = await event(120, 'PREMIUM')
    await prisma.vipEventRsvp.createMany({ data: [{ eventId: e.id, userId: club.id }, { eventId: e.id, userId: off.id }] })
    await runEventReminders(new Date(), false)
    expect(sentTo(club.email)).toHaveLength(0)
    expect(sentTo(off.email)).toHaveLength(0)
  })
})

describe('monthly event series', () => {
  it('nextMonthlyOccurrence keeps weekday-of-month and local time across DST', () => {
    const tz = 'America/New_York'
    const oct1 = zonedTimeToUtc(2026, 10, 1, 19, 0, tz) // 1st Thursday, 7pm EDT
    expect(oct1.toISOString()).toBe('2026-10-01T23:00:00.000Z')
    expect(nextMonthlyOccurrence(oct1, tz).toISOString()).toBe('2026-11-06T00:00:00.000Z') // Nov 5, 7pm EST
    const fifthFri = zonedTimeToUtc(2026, 10, 30, 12, 0, tz) // 5th Friday of Oct
    expect(nextMonthlyOccurrence(fifthFri, tz).toISOString()).toBe('2026-11-27T17:00:00.000Z') // last Friday of Nov
  })

  it('publishes the next occurrence once the latest has started; idempotent; unticking ends the series', async () => {
    const e = await prisma.vipEvent.create({
      data: { title: 'ZZ Monthly series', startsAt: new Date('2026-10-01T23:00:00Z'), endsAt: new Date('2026-10-02T00:00:00Z'), published: true, repeatMonthly: true },
    })
    const now = new Date('2026-10-02T12:00:00Z')
    await ensureEventSeries(now, false)
    await ensureEventSeries(now, false)
    const series = await prisma.vipEvent.findMany({ where: { OR: [{ id: e.id }, { seriesId: e.id }] }, orderBy: { startsAt: 'asc' } })
    expect(series.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-01T23:00:00.000Z', '2026-11-06T00:00:00.000Z'])
    expect(series[1].endsAt?.toISOString()).toBe('2026-11-06T01:00:00.000Z')
    await prisma.vipEvent.update({ where: { id: series[1].id }, data: { repeatMonthly: false } })
    await ensureEventSeries(new Date('2026-11-07T00:00:00Z'), false)
    expect(await prisma.vipEvent.count({ where: { seriesId: e.id } })).toBe(1)
  })
})

describe('email preferences', () => {
  it('signed one-click links turn a kind off; forged links are refused; a GET changes nothing', async () => {
    const u = await makeUser({ tag: 'em-prefs', tier: 'CLUB' })
    expect(verifyPrefToken(u.id, 'digest', signPrefToken(u.id, 'digest'))).toBe(true)
    expect(verifyPrefToken(u.id, 'digest', signPrefToken(u.id, 'events'))).toBe(false)
    expect(prefLink(u.id, 'events')).toMatch(/^https:\/\/vitalityproject\.vip\/email\?u=/)

    const bad = await prefsApi.POST(req('/api/vip/email-prefs', { body: { u: u.id, k: 'digest', t: 'forged' } }))
    expect(bad.status).toBe(403)
    const ok = await prefsApi.POST(req('/api/vip/email-prefs', { body: { u: u.id, k: 'events', t: signPrefToken(u.id, 'events') } }))
    expect(ok.status).toBe(200)
    const p = await prisma.vipProfile.findUniqueOrThrow({ where: { userId: u.id } })
    expect(p).toMatchObject({ emailEvents: false, emailDigest: true, emailRewards: true })

    const all = await prefsApi.POST(req('/api/vip/email-prefs', { body: { u: u.id, k: 'all', t: signPrefToken(u.id, 'all') } }))
    expect(all.status).toBe(200)
    expect(await prisma.vipProfile.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ emailEvents: false, emailDigest: false, emailRewards: false })
  })

  it('members toggle their own preferences; non-members cannot', async () => {
    const u = await makeUser({ tag: 'em-prefs-me', tier: 'PLUS' })
    setSession(u)
    const r = await prefsApi.PATCH(req('/api/vip/email-prefs', { method: 'PATCH', body: { emailDigest: false } }))
    expect(r.status).toBe(200)
    expect((await r.json()).prefs).toEqual({ emailDigest: false, emailEvents: true, emailRewards: true })
    const outsider = await makeUser({ tag: 'em-prefs-out' })
    setSession(outsider)
    expect((await prefsApi.PATCH(req('/api/vip/email-prefs', { method: 'PATCH', body: { emailDigest: false } }))).status).toBe(403)
  })
})

describe('vip-notify cron', () => {
  it('requires the cron secret when set and supports dry runs', async () => {
    process.env.CRON_SECRET = 'zz-test-cron-secret'
    try {
      expect((await notifyGET(new NextRequest('http://vitalityproject.global/api/cron/vip-notify'))).status).toBe(403)
      const ok = await notifyGET(
        new NextRequest('http://vitalityproject.global/api/cron/vip-notify?dryRun=1', { headers: { authorization: 'Bearer zz-test-cron-secret' } }),
      )
      expect(ok.status).toBe(200)
      expect((await ok.json()).dryRun).toBe(true)
      expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
    } finally {
      delete process.env.CRON_SECRET
    }
  })
})
