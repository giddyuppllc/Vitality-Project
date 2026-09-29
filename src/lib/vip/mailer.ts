import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { TIER_BENEFITS } from '@/lib/membership'
import { getVipSettings } from './settings'
import { tierAllows } from './access'
import {
  clubhouseDigestEmail,
  clubhouseWelcomeEmail,
  eventReminderEmail,
  type DigestItem,
  type Rendered,
} from './emails'
import { nextMonthlyOccurrence } from './time'

/**
 * Clubhouse email flows. Everything sends through .global's sendEmail()
 * (lib/email.ts — Resend, from noreply@vitalityproject.global) with the
 * clubhouse Reply-To. Every flow is idempotent: the "sent" stamp is claimed
 * with a conditional UPDATE before the send, so a repeat or overlapping cron
 * run never sends twice.
 *
 * Who receives clubhouse mail: members the clubhouse would let in (ACTIVE
 * paid membership, or admin), per-member preference on (VipProfile.email*),
 * not community-suspended for community mail (digest).
 */

export async function sendVipEmail(to: string, r: Rendered): Promise<boolean> {
  const { 'vip.emailReplyTo': replyTo } = await getVipSettings()
  const res = await sendEmail({ to, subject: r.subject, html: r.html, text: r.text, replyTo })
  return res.success
}

async function ensureProfile(userId: string) {
  await prisma.vipProfile.upsert({ where: { userId }, update: {}, create: { userId } })
}

// ─── Welcome ────────────────────────────────────────────────────────────────
/**
 * Sends the welcome-to-the-clubhouse email once per member (ever). Called
 * when a membership is first activated (mark-paid) and on a member's first
 * clubhouse visit (covers members who were active before launch).
 */
export async function sendClubhouseWelcome(userId: string): Promise<'sent' | 'already' | 'not_member' | 'failed'> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, role: true, membership: { select: { tier: true, status: true } } },
  })
  if (!user) return 'not_member'
  const tier = user.membership?.status === 'ACTIVE' ? user.membership.tier : 'NONE'
  if (tier === 'NONE' && user.role !== 'ADMIN') return 'not_member'
  await ensureProfile(userId)
  const now = new Date()
  const { count } = await prisma.vipProfile.updateMany({ where: { userId, welcomeEmailAt: null }, data: { welcomeEmailAt: now } })
  if (count !== 1) return 'already'
  const ok = await sendVipEmail(
    user.email,
    clubhouseWelcomeEmail({ userId, name: user.name, tierLabel: tier === 'NONE' ? 'Vitality' : TIER_BENEFITS[tier].label }),
  ).catch(() => false)
  if (!ok) {
    // Release the claim so a later trigger can retry.
    await prisma.vipProfile.updateMany({ where: { userId, welcomeEmailAt: now }, data: { welcomeEmailAt: null } })
    return 'failed'
  }
  return 'sent'
}

// ─── Daily digest ───────────────────────────────────────────────────────────
export interface DigestRun {
  skipped?: 'before_digest_hour'
  candidates: number
  sent: number
  failed: number
  wouldSend: string[]
}

const MAX_DIGEST_ITEMS = 8

function snippet(body: string | null | undefined): string {
  const s = (body ?? '').replace(/\s+/g, ' ').trim()
  return s.length > 140 ? `${s.slice(0, 137)}…` : s
}

export async function runDigest(now: Date, dryRun: boolean): Promise<DigestRun> {
  const settings = await getVipSettings()
  const hour = Math.min(23, settings['vip.digestHourUtc'])
  const out: DigestRun = { candidates: 0, sent: 0, failed: 0, wouldSend: [] }
  if (now.getUTCHours() < hour) return { ...out, skipped: 'before_digest_hour' }
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour))
  const lookback = new Date(now.getTime() - 24 * 3600e3)

  const pending = await prisma.vipNotification.groupBy({
    by: ['userId'],
    where: { readAt: null, createdAt: { gt: lookback } },
  })
  out.candidates = pending.length

  for (const { userId } of pending) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        role: true,
        membership: { select: { status: true, tier: true } },
        vipProfile: { select: { emailDigest: true, suspendedAt: true, digestSentAt: true } },
      },
    })
    if (!user) continue
    const isMember = user.role === 'ADMIN' || (user.membership?.status === 'ACTIVE' && user.membership.tier !== 'NONE')
    if (!isMember || user.vipProfile?.suspendedAt || user.vipProfile?.emailDigest === false) continue
    if (user.vipProfile?.digestSentAt && user.vipProfile.digestSentAt >= windowStart) continue
    // Honour the store-wide marketing opt-out for this optional digest.
    const comm = await prisma.communicationPreference.findUnique({ where: { userId }, select: { marketingEmail: true } })
    if (comm && comm.marketingEmail === false) continue

    const since = user.vipProfile?.digestSentAt && user.vipProfile.digestSentAt > lookback ? user.vipProfile.digestSentAt : lookback
    const notes = await prisma.vipNotification.findMany({
      where: { userId, readAt: null, createdAt: { gt: since } },
      orderBy: { createdAt: 'desc' },
    })
    if (!notes.length) continue
    if (dryRun) {
      out.wouldSend.push(userId)
      continue
    }

    await ensureProfile(userId)
    const { count } = await prisma.vipProfile.updateMany({
      where: { userId, OR: [{ digestSentAt: null }, { digestSentAt: { lt: windowStart } }] },
      data: { digestSentAt: now },
    })
    if (count !== 1) continue

    const shown = notes.slice(0, MAX_DIGEST_ITEMS)
    const actorIds = [...new Set(shown.map((n) => n.actorId).filter(Boolean) as string[])]
    const commentIds = shown.map((n) => n.commentId).filter(Boolean) as string[]
    const postIds = shown.map((n) => n.postId).filter(Boolean) as string[]
    const [actors, comments, posts] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, username: true, vipProfile: { select: { displayName: true } } } }),
      prisma.vipComment.findMany({ where: { id: { in: commentIds }, hiddenAt: null }, select: { id: true, body: true } }),
      prisma.vipPost.findMany({ where: { id: { in: postIds }, hiddenAt: null }, select: { id: true, body: true } }),
    ])
    const actorName = (id: string | null) => {
      const a = actors.find((x) => x.id === id)
      return a?.vipProfile?.displayName || a?.name || a?.username || 'A member'
    }
    const items: DigestItem[] = shown
      .filter((n) => n.postId && posts.some((p) => p.id === n.postId))
      .map((n) => ({
        type: n.type as DigestItem['type'],
        actor: actorName(n.actorId),
        snippet: snippet(comments.find((c) => c.id === n.commentId)?.body ?? posts.find((p) => p.id === n.postId)?.body),
        postId: n.postId!,
      }))
    if (!items.length) continue
    const ok = await sendVipEmail(user.email, clubhouseDigestEmail({ userId, name: user.name, items, total: notes.length })).catch(() => false)
    if (ok) out.sent++
    else out.failed++
  }
  return out
}

// ─── Event reminders ────────────────────────────────────────────────────────
export interface ReminderRun {
  sent24h: number
  sent1h: number
  failed: number
  would: Array<{ rsvpId: string; when: '24h' | '1h' }>
}

export async function runEventReminders(now: Date, dryRun: boolean): Promise<ReminderRun> {
  const { 'vip.timeZone': timeZone } = await getVipSettings()
  const out: ReminderRun = { sent24h: 0, sent1h: 0, failed: 0, would: [] }
  const horizon = new Date(now.getTime() + 24 * 3600e3)
  const rsvps = await prisma.vipEventRsvp.findMany({
    where: {
      event: { published: true, cancelledAt: null, startsAt: { gt: now, lte: horizon } },
      OR: [{ reminded24hAt: null }, { reminded1hAt: null }],
    },
    include: {
      event: true,
      user: {
        select: {
          email: true,
          name: true,
          role: true,
          membership: { select: { status: true, tier: true } },
          vipProfile: { select: { emailEvents: true } },
        },
      },
    },
  })

  for (const r of rsvps) {
    const minsLeft = (r.event.startsAt.getTime() - now.getTime()) / 60000
    let when: '24h' | '1h' | null = null
    if (minsLeft <= 60 && !r.reminded1hAt) when = '1h'
    else if (minsLeft > 60 && !r.reminded24hAt) when = '24h'
    if (!when) continue

    const u = r.user
    const tier = u.role === 'ADMIN' ? 'PREMIUM' : u.membership?.status === 'ACTIVE' ? u.membership.tier : 'NONE'
    if (!tierAllows(tier, r.event.minTier) || u.vipProfile?.emailEvents === false) continue
    if (dryRun) {
      out.would.push({ rsvpId: r.id, when })
      continue
    }

    const claim =
      when === '1h'
        ? await prisma.vipEventRsvp.updateMany({ where: { id: r.id, reminded1hAt: null }, data: { reminded1hAt: now } })
        : await prisma.vipEventRsvp.updateMany({ where: { id: r.id, reminded24hAt: null }, data: { reminded24hAt: now } })
    if (claim.count !== 1) continue
    // An hour-out reminder also covers the day-before one (never send both late).
    if (when === '1h') await prisma.vipEventRsvp.updateMany({ where: { id: r.id, reminded24hAt: null }, data: { reminded24hAt: now } })

    const ok = await sendVipEmail(
      u.email,
      eventReminderEmail({
        userId: r.userId,
        name: u.name,
        when,
        title: r.event.title,
        description: r.event.description,
        startsAt: r.event.startsAt,
        timeZone,
      }),
    ).catch(() => false)
    if (!ok) out.failed++
    else if (when === '1h') out.sent1h++
    else out.sent24h++
  }
  return out
}

// ─── Monthly event series ───────────────────────────────────────────────────
export interface SeriesRun {
  created: Array<{ seriesId: string; startsAt: string }>
}

/**
 * For every monthly series whose latest occurrence has started, publish the
 * next one (same weekday-of-month and local time). To end a series, untick
 * "Repeats monthly" on its latest occurrence.
 */
export async function ensureEventSeries(now: Date, dryRun: boolean): Promise<SeriesRun> {
  const { 'vip.timeZone': timeZone } = await getVipSettings()
  const all = await prisma.vipEvent.findMany({
    where: { OR: [{ repeatMonthly: true }, { seriesId: { not: null } }] },
    orderBy: { startsAt: 'asc' },
  })
  const latest = new Map<string, (typeof all)[number]>()
  for (const e of all) latest.set(e.seriesId ?? e.id, e) // ascending → last write wins
  const out: SeriesRun = { created: [] }
  for (const [seriesId, e] of latest) {
    if (!e.repeatMonthly || e.startsAt > now) continue
    let next = nextMonthlyOccurrence(e.startsAt, timeZone)
    // Catch up if the cron was off for a while — never publish a past date.
    while (next <= now) next = nextMonthlyOccurrence(next, timeZone)
    const exists = await prisma.vipEvent.findFirst({ where: { seriesId, startsAt: next }, select: { id: true } })
    if (exists) continue
    out.created.push({ seriesId, startsAt: next.toISOString() })
    if (dryRun) continue
    await prisma.vipEvent.create({
      data: {
        title: e.title,
        description: e.description,
        startsAt: next,
        endsAt: e.endsAt ? new Date(next.getTime() + (e.endsAt.getTime() - e.startsAt.getTime())) : null,
        joinUrl: e.joinUrl,
        minTier: e.minTier,
        published: e.published,
        createdById: e.createdById,
        repeatMonthly: true,
        seriesId,
      },
    })
  }
  return out
}

// ─── The cron entry point (api/cron/vip-notify) ─────────────────────────────
export async function runVipNotify(opts: { now?: Date; dryRun?: boolean } = {}) {
  const now = opts.now ?? new Date()
  const dryRun = !!opts.dryRun
  const series = await ensureEventSeries(now, dryRun)
  const reminders = await runEventReminders(now, dryRun)
  const digest = await runDigest(now, dryRun)
  return { ok: true as const, dryRun, at: now.toISOString(), series, reminders, digest }
}
