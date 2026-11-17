/**
 * DEV ONLY — fitness sample data for the LOCAL THROWAWAY database (screens,
 * click-throughs). Refuses to run against anything but 127.0.0.1.
 *
 *   DATABASE_URL=<127.0.0.1 throwaway> npx tsx scripts/vip/seed-fitness-dev.ts
 *
 * 1. The optional starter exercises (same insert-only seed production can run).
 * 2. CLEARLY FAKE sample content — every title starts "ZZ" and says "dev
 *    sample" — plus fake zz-*@example.invalid members (password
 *    "zz-dev-password") with workouts, check-ins and measurements. None of
 *    this is part of any production seed.
 */
import bcrypt from 'bcryptjs'
import { PrismaClient, type MembershipTier } from '@prisma/client'
import { seedFitnessExercises } from './seed-fitness-core'
import { rebuildRecords } from '../../src/lib/vip/fitness/workouts'

const url = process.env.DATABASE_URL || ''
if (!/^postgresql:\/\/[^@]+@127\.0\.0\.1:/.test(url)) {
  console.error('Refusing to seed: DATABASE_URL must point at the local throwaway DB (127.0.0.1).')
  process.exit(1)
}

const db = new PrismaClient()
const PASSWORD = 'zz-dev-password'
const DAY = 86400e3
const iso = (d: Date) => d.toISOString().slice(0, 10)
const LB = 0.45359237

async function user(tag: string, opts: { tier?: MembershipTier; role?: 'ADMIN' | 'CUSTOMER'; username: string; display: string }) {
  const email = `zz-${tag}@example.invalid`
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const u = await db.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: opts.display, username: opts.username, passwordHash, role: opts.role ?? 'CUSTOMER' },
  })
  if (opts.tier) {
    await db.membership.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, tier: opts.tier, status: 'ACTIVE', startedAt: new Date(Date.now() - 90 * DAY), paymentConfirmedAt: new Date(Date.now() - 88 * DAY) },
    })
  }
  if (opts.role !== 'ADMIN') {
    await db.vipProfile.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, displayName: opts.display, welcomeEmailAt: new Date() } })
  }
  return u
}

async function main() {
  await user('admin', { role: 'ADMIN', username: 'vitality_team', display: 'Vitality Team' })
  const maya = await user('member', { tier: 'PLUS', username: 'maya_lifts', display: 'Maya R. (fake)' })
  const dre = await user('premium', { tier: 'PREMIUM', username: 'dre_runs', display: 'Andre K. (fake)' })
  const lena = await user('club', { tier: 'CLUB', username: 'lena_moves', display: 'Lena S. (fake)' })
  const sam = await user('sam', { tier: 'PLUS', username: 'sam_zone2', display: 'Sam T. (fake)' })

  await seedFitnessExercises(db, { log: (l) => console.log(`  ${l}`) })
  const ex = Object.fromEntries((await db.vipExercise.findMany()).map((e) => [e.slug, e]))

  // ── ZZ sample program (Plus) — 2 weeks, 4 days each incl. a rest day ──
  const progSlug = 'zz-sample-strength-base'
  let program = await db.vipProgram.findUnique({ where: { slug: progSlug } })
  if (!program) {
    program = await db.vipProgram.create({
      data: {
        slug: progSlug,
        title: 'ZZ Sample Strength Base (dev sample)',
        summary: 'Dev-only sample program to exercise the builder and the logger.',
        description: '## How this sample runs\n\nThree full-body sessions and one rest day a week. **Dev sample only.**',
        level: 'Beginner',
        minTier: 'PLUS',
        published: true,
      },
    })
    const plan: { title: string; rest?: boolean; items: [string, number, string | null, number | null, number][] }[] = [
      { title: 'Full body A', items: [['back-squat', 3, '5', null, 150], ['bench-press', 3, '5', null, 150], ['bent-over-row', 3, '8-10', null, 90], ['plank', 3, null, 45, 60]] },
      { title: 'Full body B', items: [['conventional-deadlift', 3, '5', null, 180], ['overhead-press', 3, '6-8', null, 120], ['pull-up', 3, 'AMRAP', null, 120]] },
      { title: 'Rest and walk', rest: true, items: [] },
      { title: 'Full body C', items: [['goblet-squat', 3, '10', null, 90], ['dumbbell-bench-press', 3, '10', null, 90], ['walking-lunge', 2, '12 each leg', null, 90], ['farmers-carry', 3, null, 40, 60]] },
    ]
    for (const weekNumber of [1, 2]) {
      const week = await db.vipProgramWeek.create({ data: { programId: program.id, weekNumber, title: weekNumber === 1 ? 'Learn the lifts' : 'Add a little weight' } })
      for (const [i, d] of plan.entries()) {
        const day = await db.vipProgramDay.create({ data: { weekId: week.id, dayNumber: i + 1, title: d.title, isRest: !!d.rest, notes: d.rest ? 'A 30-minute easy walk.' : null } })
        if (d.rest) continue
        const w = await db.vipProgramWorkout.create({ data: { dayId: day.id, title: d.title } })
        for (const [j, [slug, sets, reps, durationSec, restSec]] of d.items.entries()) {
          await db.vipProgramPrescription.create({ data: { workoutId: w.id, exerciseId: ex[slug].id, sortOrder: j, sets, reps, durationSec, restSec } })
        }
      }
    }
  }
  if (!(await db.vipProgram.findUnique({ where: { slug: 'zz-sample-premium-block' } }))) {
    const p = await db.vipProgram.create({
      data: { slug: 'zz-sample-premium-block', title: 'ZZ Sample Premium Block (dev sample)', summary: 'Dev-only sample to show Premium Stacks gating.', minTier: 'PREMIUM', published: true, level: 'Intermediate' },
    })
    const wk = await db.vipProgramWeek.create({ data: { programId: p.id, weekNumber: 1 } })
    const d = await db.vipProgramDay.create({ data: { weekId: wk.id, dayNumber: 1, title: 'Heavy lower' } })
    const w = await db.vipProgramWorkout.create({ data: { dayId: d.id, title: 'Heavy lower' } })
    await db.vipProgramPrescription.create({ data: { workoutId: w.id, exerciseId: ex['back-squat'].id, sets: 5, reps: '3' } })
  }

  // ── ZZ sample challenges (dates around today) ──
  const today = new Date()
  const challenges = [
    { slug: 'zz-sample-12-workouts', title: 'ZZ 12 Workouts in 30 Days (dev sample)', metric: 'WORKOUTS' as const, target: 12, start: -10, end: 20, pointsReward: 500, badgeLabel: 'ZZ 12 in 30' },
    { slug: 'zz-sample-step-up', title: 'ZZ Step Up Week (dev sample)', metric: 'STEPS' as const, target: 50000, start: -3, end: 4, pointsReward: 200, badgeLabel: null },
    { slug: 'zz-sample-coach-scored', title: 'ZZ Coach-Scored Form Check (dev sample)', metric: 'CUSTOM_POINTS' as const, target: 10, start: -5, end: 25, pointsReward: 100, badgeLabel: null },
  ]
  for (const c of challenges) {
    if (await db.vipChallenge.findUnique({ where: { slug: c.slug } })) continue
    await db.vipChallenge.create({
      data: {
        slug: c.slug,
        title: c.title,
        description: 'Dev-only sample challenge.',
        metric: c.metric,
        target: c.target,
        startDate: iso(new Date(today.getTime() + c.start * DAY)),
        endDate: iso(new Date(today.getTime() + c.end * DAY)),
        pointsReward: c.pointsReward,
        badgeLabel: c.badgeLabel,
        published: true,
      },
    })
  }

  // ── ZZ sample articles ──
  const articles = [
    { slug: 'zz-sample-protein-at-breakfast', title: 'ZZ Sample: Build a Better Breakfast (dev sample)', category: 'NUTRITION' as const, minTier: 'CLUB' as const },
    { slug: 'zz-sample-wind-down', title: 'ZZ Sample: A 20-Minute Wind-Down (dev sample)', category: 'SLEEP' as const, minTier: 'PREMIUM' as const },
  ]
  for (const a of articles) {
    if (await db.vipArticle.findUnique({ where: { slug: a.slug } })) continue
    await db.vipArticle.create({
      data: {
        ...a,
        summary: 'Dev-only sample article for layout checks.',
        body: '## Sample heading\n\nDev sample paragraph for checking the reader layout. **Bold**, *italic* and a list:\n\n- One\n- Two\n- Three',
        published: true,
        publishedAt: new Date(),
      },
    })
  }

  // ── Fake activity: past workouts, check-ins, measurements ──
  const challenge = await db.vipChallenge.findUniqueOrThrow({ where: { slug: 'zz-sample-12-workouts' } })
  for (const [u, sessions, base] of [
    [maya, 14, 95],
    [dre, 9, 120],
    [lena, 5, 60],
    [sam, 11, 85],
  ] as const) {
    if (await db.vipWorkoutLog.count({ where: { userId: u.id } })) continue
    for (let i = sessions; i >= 1; i--) {
      const at = new Date(Date.now() - i * 2.5 * DAY)
      const kg = (base + (sessions - i) * 2.5) * LB
      const log = await db.vipWorkoutLog.create({
        data: { userId: u.id, title: i % 2 ? 'Upper body (fake)' : 'Lower body (fake)', startedAt: new Date(at.getTime() - 3600e3), finishedAt: at, localDate: iso(at), durationSec: 3300, exerciseOrder: [] },
      })
      const lifts = i % 2 ? ['bench-press', 'bent-over-row'] : ['back-squat', 'romanian-deadlift']
      let vol = 0
      let n = 0
      for (const slug of lifts) {
        for (let s = 1; s <= 3; s++) {
          const reps = 8 - (s === 3 ? 1 : 0)
          await db.vipWorkoutSet.create({ data: { logId: log.id, exerciseId: ex[slug].id, setNumber: s, weightKg: kg * (slug.includes('squat') || slug.includes('deadlift') ? 1.4 : 1), reps, rpe: 7 + s * 0.5 } })
          vol += kg * reps
          n++
        }
      }
      await db.vipWorkoutSet.create({ data: { logId: log.id, exerciseId: ex['plank'].id, setNumber: 1, durationSec: 40 + (sessions - i) * 3 } })
      await db.vipWorkoutLog.update({ where: { id: log.id }, data: { exerciseOrder: [...lifts.map((s) => ex[s].id), ex['plank'].id], totalVolumeKg: vol, totalSets: n + 1 } })
    }
    for (const slug of ['bench-press', 'bent-over-row', 'back-squat', 'romanian-deadlift', 'plank']) await rebuildRecords(u.id, ex[slug].id)
    await db.vipChallengeParticipant.upsert({ where: { challengeId_userId: { challengeId: challenge.id, userId: u.id } }, update: {}, create: { challengeId: challenge.id, userId: u.id } })
  }
  await db.vipFitnessProfile.upsert({ where: { userId: sam.id }, update: { hideFromLeaderboards: true }, create: { userId: sam.id, hideFromLeaderboards: true } })

  if (!(await db.vipCheckin.count({ where: { userId: maya.id } }))) {
    for (let i = 9; i >= 1; i--) {
      const d = iso(new Date(Date.now() - i * DAY))
      await db.vipCheckin.create({
        data: { userId: maya.id, date: d, waterMl: 2000 + (i % 3) * 250, sleepHours: 6.5 + (i % 4) * 0.5, steps: 6000 + i * 700, mood: 3 + (i % 3), energy: 3 + ((i + 1) % 3), workoutDone: i % 2 === 0 },
      })
    }
    for (let i = 8; i >= 0; i--) {
      await db.vipBodyMetric.create({
        data: { userId: maya.id, date: iso(new Date(Date.now() - (i * 7 + 1) * DAY)), weightKg: (152 - (8 - i) * 0.6) * LB, bodyFatPct: 27 - (8 - i) * 0.3, waistCm: (31 - (8 - i) * 0.15) * 2.54 },
      })
    }
  }
  console.log('Dev fitness sample data ready. Sign in as zz-member@example.invalid / zz-dev-password (Plus).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
