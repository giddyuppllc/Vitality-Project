import { prisma } from '@/lib/prisma'
import { awardPoints } from '@/lib/vip/points'
import { addDays, completedSevenDayBlocks, currentStreak, daysBetween, lastNDates, localDate, longestRun } from './dates'
import { getFitnessPoints } from './settings'
import { evaluateChallengesFor } from './challenges'

/**
 * Habits & health — PRIVATE to the member. Nothing here is shown to other
 * members or to the community; every read and write is keyed by the signed-in
 * member's own id.
 *
 * Check-ins belong to the member's local calendar day. A member can create or
 * edit today's check-in and yesterday's (for "forgot last night"), nothing
 * older — which also keeps the 7-day streak awards stable (see dates.ts).
 */

export interface CheckinInput {
  waterMl?: number | null
  sleepHours?: number | null
  steps?: number | null
  mood?: number | null
  energy?: number | null
  workoutDone?: boolean
  notes?: string | null
}

export class HealthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

const clampInt = (v: number | null | undefined, min: number, max: number) =>
  v == null || !Number.isFinite(v) ? null : Math.min(max, Math.max(min, Math.round(v)))

export function cleanCheckin(input: CheckinInput) {
  return {
    waterMl: clampInt(input.waterMl, 0, 20_000),
    sleepHours: input.sleepHours == null || !Number.isFinite(input.sleepHours) ? null : Math.min(24, Math.max(0, Math.round(input.sleepHours * 4) / 4)),
    steps: clampInt(input.steps, 0, 200_000),
    mood: clampInt(input.mood, 1, 5),
    energy: clampInt(input.energy, 1, 5),
    workoutDone: !!input.workoutDone,
    notes: input.notes?.trim().slice(0, 1000) || null,
  }
}

export interface CheckinResult {
  date: string
  created: boolean
  points: number
  streak: number
  streakBonus: number
  challengesCompleted: { title: string; points: number }[]
}

/**
 * Save the check-in for `day` ('today' | 'yesterday' in the member's zone).
 * Points: the check-in award once per local date (checkin:<userId>:<date>)
 * and 100 for every completed 7-day block (streak7:<userId>:<blockStart>).
 */
export async function saveCheckin(
  userId: string,
  timeZone: string,
  day: 'today' | 'yesterday',
  input: CheckinInput,
  now = new Date(),
): Promise<CheckinResult> {
  const today = localDate(now, timeZone)
  const date = day === 'yesterday' ? addDays(today, -1) : today
  const data = cleanCheckin(input)
  // A finished workout that day ticks the box even if the member didn't.
  if (!data.workoutDone) {
    data.workoutDone = !!(await prisma.vipWorkoutLog.findFirst({ where: { userId, localDate: date, finishedAt: { not: null } }, select: { id: true } }))
  }
  const existing = await prisma.vipCheckin.findUnique({ where: { userId_date: { userId, date } } })
  await prisma.vipCheckin.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  })

  const settings = await getFitnessPoints()
  let points = 0
  if (settings['vip.fitness.points.checkin'] > 0) {
    const r = await awardPoints({
      userId,
      points: settings['vip.fitness.points.checkin'],
      type: 'EARN_ENGAGEMENT',
      description: 'Daily check-in',
      idempotencyKey: `checkin:${userId}:${date}`,
    })
    if (!r.duplicate) points += r.points
  }

  const dates = await checkinDates(userId, '0000-01-01', today)
  let streakBonus = 0
  if (settings['vip.fitness.points.streak7'] > 0) {
    for (const blockStart of completedSevenDayBlocks(dates, date)) {
      const r = await awardPoints({
        userId,
        points: settings['vip.fitness.points.streak7'],
        type: 'EARN_ENGAGEMENT',
        description: '7-day check-in streak',
        idempotencyKey: `streak7:${userId}:${blockStart}`,
      })
      if (!r.duplicate) streakBonus += r.points
    }
  }

  const challengesCompleted = await evaluateChallengesFor(userId, now)
  return { date, created: !existing, points, streak: currentStreak(dates, today), streakBonus, challengesCompleted }
}

export async function checkinDates(userId: string, from: string, to: string): Promise<Set<string>> {
  const rows = await prisma.vipCheckin.findMany({ where: { userId, date: { gte: from, lte: to } }, select: { date: true } })
  return new Set(rows.map((r) => r.date))
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Last 7 local days (today inclusive). */
export async function weeklySummary(userId: string, today: string) {
  const days = lastNDates(today, 7)
  const [checkins, workouts] = await Promise.all([
    prisma.vipCheckin.findMany({ where: { userId, date: { gte: days[0], lte: today } }, orderBy: { date: 'asc' } }),
    prisma.vipWorkoutLog.count({ where: { userId, finishedAt: { not: null }, localDate: { gte: days[0], lte: today } } }),
  ])
  const steps = checkins.map((c) => c.steps).filter((x): x is number => x != null)
  return {
    from: days[0],
    to: today,
    days: days.map((d) => ({ date: d, checkin: checkins.find((c) => c.date === d) ?? null })),
    checkinDays: checkins.length,
    workouts,
    avgSleep: avg(checkins.map((c) => c.sleepHours)),
    avgWaterMl: avg(checkins.map((c) => c.waterMl)),
    totalSteps: steps.length ? steps.reduce((a, b) => a + b, 0) : null,
    avgSteps: avg(checkins.map((c) => c.steps)),
    avgMood: avg(checkins.map((c) => c.mood)),
    avgEnergy: avg(checkins.map((c) => c.energy)),
  }
}

export async function streakInfo(userId: string, today: string) {
  const dates = await checkinDates(userId, '0000-01-01', today)
  return { current: currentStreak(dates, today), best: longestRun(dates), checkedInToday: dates.has(today) }
}

/** Check-ins for the last `n` days (for the habit grid), oldest first. */
export async function recentCheckins(userId: string, today: string, n = 28) {
  const from = addDays(today, -(n - 1))
  const rows = await prisma.vipCheckin.findMany({ where: { userId, date: { gte: from, lte: today } } })
  const by = new Map(rows.map((r) => [r.date, r]))
  return lastNDates(today, n).map((d) => ({ date: d, checkin: by.get(d) ?? null }))
}

// ─── Body metrics ──────────────────────────────────────────────────────────

export interface BodyMetricInput {
  weightKg?: number | null
  bodyFatPct?: number | null
  waistCm?: number | null
  chestCm?: number | null
  hipsCm?: number | null
  armCm?: number | null
  thighCm?: number | null
  notes?: string | null
}

const clampF = (v: number | null | undefined, min: number, max: number) =>
  v == null || !Number.isFinite(v) || v <= 0 ? null : Math.min(max, Math.max(min, Math.round(v * 100) / 100))

/** Upsert the entry for a local date (today or any day in the past year). */
export async function saveBodyMetric(userId: string, timeZone: string, date: string, input: BodyMetricInput, now = new Date()) {
  const today = localDate(now, timeZone)
  const diff = daysBetween(date, today)
  if (diff < 0) throw new HealthError('That date is in the future', 400)
  if (diff > 366) throw new HealthError('Entries can go back one year', 400)
  const data = {
    weightKg: clampF(input.weightKg, 20, 400),
    bodyFatPct: clampF(input.bodyFatPct, 2, 75),
    waistCm: clampF(input.waistCm, 20, 300),
    chestCm: clampF(input.chestCm, 20, 300),
    hipsCm: clampF(input.hipsCm, 20, 300),
    armCm: clampF(input.armCm, 10, 120),
    thighCm: clampF(input.thighCm, 10, 200),
    notes: input.notes?.trim().slice(0, 1000) || null,
  }
  const hasAny = Object.entries(data).some(([k, v]) => k !== 'notes' && v != null)
  if (!hasAny) throw new HealthError('Enter at least one measurement', 400)
  return prisma.vipBodyMetric.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  })
}

export async function deleteBodyMetric(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.vipBodyMetric.deleteMany({ where: { id, userId } })
  return count > 0
}

export async function listBodyMetrics(userId: string, take = 120) {
  return prisma.vipBodyMetric.findMany({ where: { userId }, orderBy: { date: 'desc' }, take })
}
