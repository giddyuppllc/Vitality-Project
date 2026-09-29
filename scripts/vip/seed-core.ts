/**
 * Insert-only clubhouse seed. Shared by scripts/seed-vip-clubhouse.ts
 * (production, run by hand at deploy) and scripts/vip/seed-dev.ts.
 *
 * NEVER updates or deletes an existing row: every object is looked up by
 * its natural key (space slug, course slug, event title, post marker, tier)
 * and created only when absent. Running it again is a no-op.
 *
 * Creates no members and no member posts — only the team account's two
 * pinned posts (welcome + guidelines), and only when an ADMIN author is given.
 */
import type { PrismaClient } from '@prisma/client'
import { COURSES, EVENTS, SPACES, TEAM_POSTS } from './starter-content'
import { zonedParts, zonedTimeToUtc } from '../../src/lib/vip/time'

export interface SeedOptions {
  /** Existing ADMIN account the welcome + guidelines posts are authored by. */
  authorEmail?: string | null
  now?: Date
  dryRun?: boolean
  timeZone?: string
  log?: (line: string) => void
}

export interface SeedReport {
  created: string[]
  skipped: string[]
  warnings: string[]
}

const DEFAULT_REWARDS = { CLUB: 500, PLUS: 2000, PREMIUM: 5000 } as const

/** First date matching "nth weekday at hh:mm" (zone) that is at least `minDays` after now. */
export function firstOccurrence(now: Date, rule: { nth: number; weekday: number; hour: number; minute: number }, timeZone: string, minDays = 3): Date {
  const earliest = new Date(now.getTime() + minDays * 86400e3)
  const z = zonedParts(now, timeZone)
  for (let i = 0; i < 4; i++) {
    const m0 = z.month - 1 + i
    const y = z.year + Math.floor(m0 / 12)
    const m = (m0 % 12) + 1
    const firstWd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
    const day = 1 + ((rule.weekday - firstWd + 7) % 7) + (rule.nth - 1) * 7
    const at = zonedTimeToUtc(y, m, day, rule.hour, rule.minute, timeZone)
    if (at >= earliest) return at
  }
  throw new Error('no occurrence found')
}

export async function seedClubhouse(prisma: PrismaClient, opts: SeedOptions = {}): Promise<SeedReport> {
  const now = opts.now ?? new Date()
  const tz = opts.timeZone ?? 'America/New_York'
  const dry = !!opts.dryRun
  const log = opts.log ?? (() => {})
  const r: SeedReport = { created: [], skipped: [], warnings: [] }
  const created = (s: string) => (r.created.push(s), log(`${dry ? 'would create' : 'created'}: ${s}`))
  const skipped = (s: string) => (r.skipped.push(s), log(`exists, left untouched: ${s}`))

  // ── Author (team account) ────────────────────────────────────────────────
  let authorId: string | null = null
  if (opts.authorEmail) {
    const a = await prisma.user.findUnique({ where: { email: opts.authorEmail.toLowerCase() }, select: { id: true, role: true } })
    if (!a) r.warnings.push(`author ${opts.authorEmail} not found — team posts skipped`)
    else if (a.role !== 'ADMIN') r.warnings.push(`author ${opts.authorEmail} is not an ADMIN — team posts skipped`)
    else authorId = a.id
  } else {
    r.warnings.push('no author given (VIP_SEED_AUTHOR_EMAIL) — team posts skipped')
  }
  if (authorId) {
    const p = await prisma.vipProfile.findUnique({ where: { userId: authorId } })
    if (p) skipped(`profile for team author (display name stays "${p.displayName ?? ''}")`)
    else {
      created('profile "Vitality Team" for the team author')
      if (!dry) await prisma.vipProfile.create({ data: { userId: authorId, displayName: 'Vitality Team', bio: 'The Vitality Project team — coaches, programming and Clubhouse hosts.' } })
    }
  }

  // ── Spaces ───────────────────────────────────────────────────────────────
  const spaceIds: Record<string, string> = {}
  for (const s of SPACES) {
    const existing = await prisma.vipSpace.findUnique({ where: { slug: s.slug } })
    if (existing) {
      spaceIds[s.slug] = existing.id
      skipped(`space ${s.slug}`)
      continue
    }
    created(`space ${s.slug}`)
    if (!dry) spaceIds[s.slug] = (await prisma.vipSpace.create({ data: { ...s } })).id
  }

  // ── Team posts (pinned) ──────────────────────────────────────────────────
  if (authorId) {
    for (const post of TEAM_POSTS) {
      const existing = await prisma.vipPost.findFirst({ where: { body: { startsWith: post.marker } }, select: { id: true } })
      if (existing) {
        skipped(`post "${post.marker}"`)
        continue
      }
      created(`pinned post "${post.marker}"`)
      if (!dry) {
        await prisma.vipPost.create({
          data: { authorId, body: post.body, pinned: true, isAnnouncement: true, spaceId: spaceIds.announcements ?? null },
        })
      }
    }
  }

  // ── Classroom ────────────────────────────────────────────────────────────
  for (const c of COURSES) {
    const existing = await prisma.vipCourse.findUnique({ where: { slug: c.slug } })
    if (existing) {
      skipped(`course ${c.slug}`)
      continue
    }
    const lessons = c.modules.reduce((n, m) => n + m.lessons.length, 0)
    created(`course ${c.slug} (${c.modules.length} modules, ${lessons} lessons)`)
    if (dry) continue
    const course = await prisma.vipCourse.create({
      data: { slug: c.slug, title: c.title, summary: c.summary, minTier: c.minTier, sortOrder: c.sortOrder, published: true },
    })
    for (const [mi, m] of c.modules.entries()) {
      const mod = await prisma.vipModule.create({ data: { courseId: course.id, title: m.title, sortOrder: mi } })
      for (const [li, l] of m.lessons.entries()) {
        await prisma.vipLesson.create({ data: { moduleId: mod.id, title: l.title, body: l.body, sortOrder: li, published: true } })
      }
    }
  }

  // ── Events (monthly series; join link left empty for the admin to add) ──
  for (const e of EVENTS) {
    const existing = await prisma.vipEvent.findFirst({ where: { title: e.title }, select: { id: true } })
    if (existing) {
      skipped(`event "${e.title}"`)
      continue
    }
    const startsAt = firstOccurrence(now, e.rule, tz)
    created(`event "${e.title}" first on ${startsAt.toISOString()} (repeats monthly)`)
    if (!dry) {
      await prisma.vipEvent.create({
        data: {
          title: e.title,
          description: e.description,
          startsAt,
          endsAt: new Date(startsAt.getTime() + e.durationMin * 60000),
          minTier: e.minTier,
          published: true,
          repeatMonthly: true,
          createdById: authorId,
        },
      })
    }
  }

  // ── Reward amounts (visible + editable in /admin/vip/rewards) ────────────
  for (const tier of ['CLUB', 'PLUS', 'PREMIUM'] as const) {
    const existing = await prisma.vipTierReward.findUnique({ where: { tier } })
    if (existing) {
      skipped(`reward setting ${tier}`)
      continue
    }
    created(`reward setting ${tier} = ${DEFAULT_REWARDS[tier]}¢/month`)
    if (!dry) await prisma.vipTierReward.create({ data: { tier, monthlyCreditCents: DEFAULT_REWARDS[tier] } })
  }

  return r
}
