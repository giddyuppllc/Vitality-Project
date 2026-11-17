import type { MembershipTier, Prisma, VipExerciseMeasure } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from '@/lib/vip/access'
import { awardPoints } from '@/lib/vip/points'
import { addDays, localDate } from './dates'
import { detectPrs, KINDS_FOR, setValue, setVolumeKg, type PrKind, type PrResult } from './prs'
import { getFitnessPoints } from './settings'
import { completeProgramDay, ProgramError } from './programs'
import { evaluateChallengesFor } from './challenges'

/**
 * Workout logger. A workout is created when the member presses Start and
 * every set is saved the moment it's logged (a dropped connection or a
 * closed tab loses nothing). Finishing computes the totals, detects personal
 * records, awards the day's workout points (once per local day), and ticks
 * off the program day it came from.
 *
 * Every function takes the member's id and only ever touches that member's
 * own workouts: someone else's workout id behaves exactly like a missing one.
 */

export const MAX_SETS_PER_WORKOUT = 200
export const MAX_EXERCISES_PER_WORKOUT = 40

export class WorkoutError extends ProgramError {}

async function ownWorkout(userId: string, logId: string) {
  const log = await prisma.vipWorkoutLog.findUnique({ where: { id: logId } })
  if (!log || log.userId !== userId) throw new WorkoutError('Workout not found', 404)
  return log
}

async function openWorkout(userId: string, logId: string) {
  const log = await ownWorkout(userId, logId)
  if (log.finishedAt) throw new WorkoutError('This workout is already finished', 409)
  return log
}

export async function findOpenWorkout(userId: string) {
  return prisma.vipWorkoutLog.findFirst({
    where: { userId, finishedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { id: true, title: true, startedAt: true },
  })
}

/**
 * Start a workout — from a program day (the prescriptions become the plan)
 * or freestyle. One open workout at a time: if one is already in progress
 * this throws 409 with its id so the member can resume or discard it.
 */
export async function startWorkout(
  userId: string,
  accessTier: MembershipTier,
  input: { programDayId?: string | null; title?: string | null },
) {
  const open = await findOpenWorkout(userId)
  if (open) {
    const err = new WorkoutError('You already have a workout in progress', 409)
    ;(err as WorkoutError & { openId?: string }).openId = open.id
    throw err
  }
  if (input.programDayId) {
    const day = await prisma.vipProgramDay.findUnique({
      where: { id: input.programDayId },
      include: {
        week: { include: { program: true } },
        workouts: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { prescriptions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { exerciseId: true } } },
        },
      },
    })
    const program = day?.week.program
    if (!day || !program || !program.published) throw new WorkoutError('Program day not found', 404)
    if (!tierAllows(accessTier, program.minTier)) throw new WorkoutError('This program needs a higher membership tier', 403)
    if (day.isRest) throw new WorkoutError('That is a rest day', 400)
    const enrollment = await prisma.vipProgramEnrollment.findUnique({
      where: { userId_programId: { userId, programId: program.id } },
    })
    if (!enrollment || enrollment.status !== 'ACTIVE') throw new WorkoutError('Start the program first', 409)
    const order = [...new Set(day.workouts.flatMap((w) => w.prescriptions.map((p) => p.exerciseId)))]
    return prisma.vipWorkoutLog.create({
      data: {
        userId,
        title: `${program.title} · ${day.title}`.slice(0, 160),
        enrollmentId: enrollment.id,
        programDayId: day.id,
        exerciseOrder: order.slice(0, MAX_EXERCISES_PER_WORKOUT),
      },
    })
  }
  const title = (input.title ?? '').trim().slice(0, 160) || 'Workout'
  return prisma.vipWorkoutLog.create({ data: { userId, title, exerciseOrder: [] } })
}

async function publishedExercise(exerciseId: string) {
  const ex = await prisma.vipExercise.findUnique({ where: { id: exerciseId }, select: { id: true, published: true, measure: true } })
  if (!ex || !ex.published) throw new WorkoutError('Exercise not found', 404)
  return ex
}

export async function addExercise(userId: string, logId: string, exerciseId: string) {
  const log = await openWorkout(userId, logId)
  await publishedExercise(exerciseId)
  if (log.exerciseOrder.includes(exerciseId)) return log
  if (log.exerciseOrder.length >= MAX_EXERCISES_PER_WORKOUT) throw new WorkoutError('That is a lot of exercises for one workout', 400)
  return prisma.vipWorkoutLog.update({ where: { id: log.id }, data: { exerciseOrder: [...log.exerciseOrder, exerciseId] } })
}

/** Drop an exercise from the workout (and any sets logged for it). */
export async function removeExercise(userId: string, logId: string, exerciseId: string) {
  const log = await openWorkout(userId, logId)
  await prisma.$transaction([
    prisma.vipWorkoutSet.deleteMany({ where: { logId: log.id, exerciseId } }),
    prisma.vipWorkoutLog.update({ where: { id: log.id }, data: { exerciseOrder: log.exerciseOrder.filter((e) => e !== exerciseId) } }),
  ])
}

export interface SetInput {
  weightKg?: number | null
  reps?: number | null
  durationSec?: number | null
  rpe?: number | null
}

function cleanSet(measure: VipExerciseMeasure, s: SetInput) {
  const weightKg = s.weightKg != null && s.weightKg > 0 ? Math.round(s.weightKg * 1000) / 1000 : null
  const reps = s.reps != null && s.reps > 0 ? Math.round(s.reps) : null
  const durationSec = s.durationSec != null && s.durationSec > 0 ? Math.round(s.durationSec) : null
  const rpe = s.rpe != null && s.rpe >= 1 ? Math.round(s.rpe * 2) / 2 : null
  if (measure === 'TIME' && !durationSec) throw new WorkoutError('Enter a time for this set', 400)
  if (measure !== 'TIME' && !reps) throw new WorkoutError('Enter the reps for this set', 400)
  return { weightKg, reps, durationSec, rpe }
}

export async function addSet(userId: string, logId: string, exerciseId: string, input: SetInput) {
  const log = await openWorkout(userId, logId)
  const ex = await publishedExercise(exerciseId)
  const data = cleanSet(ex.measure, input)
  const total = await prisma.vipWorkoutSet.count({ where: { logId: log.id } })
  if (total >= MAX_SETS_PER_WORKOUT) throw new WorkoutError('Set limit reached for this workout', 400)
  const last = await prisma.vipWorkoutSet.findFirst({
    where: { logId: log.id, exerciseId },
    orderBy: { setNumber: 'desc' },
    select: { setNumber: true },
  })
  if (!log.exerciseOrder.includes(exerciseId)) {
    await prisma.vipWorkoutLog.update({ where: { id: log.id }, data: { exerciseOrder: [...log.exerciseOrder, exerciseId] } })
  }
  return prisma.vipWorkoutSet.create({
    data: { logId: log.id, exerciseId, setNumber: (last?.setNumber ?? 0) + 1, ...data },
  })
}

async function ownSet(userId: string, logId: string, setId: string) {
  await openWorkout(userId, logId)
  const set = await prisma.vipWorkoutSet.findUnique({ where: { id: setId }, include: { exercise: { select: { measure: true } } } })
  if (!set || set.logId !== logId) throw new WorkoutError('Set not found', 404)
  return set
}

export async function updateSet(userId: string, logId: string, setId: string, input: SetInput) {
  const set = await ownSet(userId, logId, setId)
  const merged: SetInput = {
    weightKg: input.weightKg !== undefined ? input.weightKg : set.weightKg,
    reps: input.reps !== undefined ? input.reps : set.reps,
    durationSec: input.durationSec !== undefined ? input.durationSec : set.durationSec,
    rpe: input.rpe !== undefined ? input.rpe : set.rpe,
  }
  return prisma.vipWorkoutSet.update({ where: { id: set.id }, data: cleanSet(set.exercise.measure, merged) })
}

/** Delete a set; later sets of the same exercise move up one number. */
export async function deleteSet(userId: string, logId: string, setId: string) {
  const set = await ownSet(userId, logId, setId)
  await prisma.$transaction(async (tx) => {
    await tx.vipWorkoutSet.delete({ where: { id: set.id } })
    const later = await tx.vipWorkoutSet.findMany({
      where: { logId, exerciseId: set.exerciseId, setNumber: { gt: set.setNumber } },
      orderBy: { setNumber: 'asc' },
    })
    for (const s of later) await tx.vipWorkoutSet.update({ where: { id: s.id }, data: { setNumber: s.setNumber - 1 } })
  })
}

export async function updateWorkoutMeta(userId: string, logId: string, data: { title?: string; notes?: string | null }) {
  const log = await ownWorkout(userId, logId)
  return prisma.vipWorkoutLog.update({
    where: { id: log.id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim().slice(0, 160) || log.title } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim().slice(0, 2000) || null } : {}),
    },
  })
}

/** Discard an unfinished workout, or delete a finished one from history (records are rebuilt). */
export async function deleteWorkout(userId: string, logId: string) {
  const log = await ownWorkout(userId, logId)
  const exerciseIds = [...new Set((await prisma.vipWorkoutSet.findMany({ where: { logId }, select: { exerciseId: true } })).map((s) => s.exerciseId))]
  await prisma.vipWorkoutLog.delete({ where: { id: log.id } })
  if (log.finishedAt) for (const ex of exerciseIds) await rebuildRecords(userId, ex)
}

/** Recompute a member's records for one exercise from every finished set. */
export async function rebuildRecords(userId: string, exerciseId: string) {
  const ex = await prisma.vipExercise.findUnique({ where: { id: exerciseId }, select: { measure: true } })
  if (!ex) return
  const sets = await prisma.vipWorkoutSet.findMany({
    where: { exerciseId, log: { userId, finishedAt: { not: null } } },
    include: { log: { select: { finishedAt: true } } },
  })
  for (const kind of KINDS_FOR[ex.measure]) {
    let best: { value: number; setId: string; at: Date } | null = null
    for (const s of sets) {
      const v = setValue(kind, s)
      if (v != null && (!best || v > best.value)) best = { value: v, setId: s.id, at: s.log.finishedAt! }
    }
    if (!best) {
      await prisma.vipPersonalRecord.deleteMany({ where: { userId, exerciseId, kind } })
    } else {
      await prisma.vipPersonalRecord.upsert({
        where: { userId_exerciseId_kind: { userId, exerciseId, kind } },
        create: { userId, exerciseId, kind, value: best.value, setId: best.setId, achievedAt: best.at },
        update: { value: best.value, setId: best.setId, achievedAt: best.at },
      })
    }
  }
}

export interface FinishSummary {
  logId: string
  title: string
  localDate: string
  durationSec: number
  totalSets: number
  totalVolumeKg: number
  exercises: { id: string; name: string; sets: number }[]
  prs: (PrResult & { exerciseId: string; exerciseName: string; measure: VipExerciseMeasure })[]
  pointsAwarded: number
  programCompleted: boolean
  programPoints: number
  challengesCompleted: { title: string; points: number }[]
}

/**
 * Finish a workout. Safe to call twice (the second call changes nothing and
 * returns the same summary). Workout points: once per member per local day
 * (key workout-day:<userId>:<date>).
 */
export async function finishWorkout(userId: string, logId: string, timeZone: string, now = new Date()): Promise<FinishSummary> {
  const log = await ownWorkout(userId, logId)
  if (log.finishedAt) return workoutSummary(userId, logId)
  const sets = await prisma.vipWorkoutSet.findMany({
    where: { logId },
    orderBy: [{ setNumber: 'asc' }],
    include: { exercise: { select: { id: true, name: true, measure: true } } },
  })
  if (sets.length === 0) throw new WorkoutError('Log at least one set before finishing', 400)

  const date = localDate(now, timeZone)
  const durationSec = Math.max(1, Math.min(24 * 3600, Math.round((now.getTime() - log.startedAt.getTime()) / 1000)))
  const totalVolumeKg = sets.reduce((a, s) => a + setVolumeKg(s), 0)

  // Claim the finish (conditional) so a double tap can't finish twice.
  const { count } = await prisma.vipWorkoutLog.updateMany({
    where: { id: logId, userId, finishedAt: null },
    data: { finishedAt: now, localDate: date, durationSec, totalVolumeKg, totalSets: sets.length },
  })
  if (count === 0) return workoutSummary(userId, logId)

  // Personal records, per exercise, against the member's previous bests.
  const prs: FinishSummary['prs'] = []
  const byExercise = new Map<string, typeof sets>()
  for (const s of sets) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
  for (const [exerciseId, exSets] of byExercise) {
    const ex = exSets[0].exercise
    const prev = await prisma.vipPersonalRecord.findMany({ where: { userId, exerciseId } })
    const previous: Partial<Record<PrKind, number>> = {}
    for (const r of prev) previous[r.kind as PrKind] = r.value
    for (const pr of detectPrs(ex.measure, previous, exSets)) {
      await prisma.vipPersonalRecord.upsert({
        where: { userId_exerciseId_kind: { userId, exerciseId, kind: pr.kind } },
        create: { userId, exerciseId, kind: pr.kind, value: pr.value, setId: pr.setId, achievedAt: now },
        update: { value: pr.value, setId: pr.setId, achievedAt: now },
      })
      prs.push({ ...pr, exerciseId, exerciseName: ex.name, measure: ex.measure })
    }
  }

  // Points: one workout award per local day.
  const amount = (await getFitnessPoints())['vip.fitness.points.workout']
  let pointsAwarded = 0
  if (amount > 0) {
    const r = await awardPoints({
      userId,
      points: amount,
      type: 'EARN_ENGAGEMENT',
      description: 'Workout logged',
      idempotencyKey: `workout-day:${userId}:${date}`,
    })
    if (!r.duplicate) pointsAwarded = amount
  }
  await prisma.vipWorkoutLog.update({
    where: { id: logId },
    data: { pointsAwarded, prSummary: prs as unknown as Prisma.InputJsonValue },
  })

  // A check-in for that day now shows the workout as done.
  await prisma.vipCheckin.updateMany({ where: { userId, date }, data: { workoutDone: true } })

  let programCompleted = false
  let programPoints = 0
  if (log.enrollmentId && log.programDayId) {
    const r = await completeProgramDay({ userId, enrollmentId: log.enrollmentId, dayId: log.programDayId, workoutLogId: log.id }).catch(
      () => ({ programCompleted: false, points: 0 }),
    )
    programCompleted = r.programCompleted
    programPoints = r.points
  }

  const challengesCompleted = await evaluateChallengesFor(userId, now)
  const summary = await workoutSummary(userId, logId)
  return { ...summary, prs, programCompleted, programPoints, challengesCompleted }
}

/** Summary of a finished workout (PRs as they were set when it finished). */
export async function workoutSummary(userId: string, logId: string): Promise<FinishSummary> {
  const log = await ownWorkout(userId, logId)
  const sets = await prisma.vipWorkoutSet.findMany({
    where: { logId },
    include: { exercise: { select: { id: true, name: true, measure: true } } },
  })
  const exMap = new Map<string, { id: string; name: string; sets: number }>()
  for (const s of sets) {
    const e = exMap.get(s.exerciseId) ?? { id: s.exerciseId, name: s.exercise.name, sets: 0 }
    e.sets += 1
    exMap.set(s.exerciseId, e)
  }
  const ordered = [
    ...log.exerciseOrder.map((id) => exMap.get(id)).filter((e): e is NonNullable<typeof e> => !!e),
    ...[...exMap.values()].filter((e) => !log.exerciseOrder.includes(e.id)),
  ]
  const prs = (Array.isArray(log.prSummary) ? log.prSummary : []) as unknown as FinishSummary['prs']
  return {
    logId: log.id,
    title: log.title,
    localDate: log.localDate ?? localDate(log.startedAt, 'UTC'),
    durationSec: log.durationSec ?? 0,
    totalSets: log.totalSets,
    totalVolumeKg: log.totalVolumeKg,
    exercises: ordered,
    prs,
    pointsAwarded: log.pointsAwarded,
    programCompleted: false,
    programPoints: 0,
    challengesCompleted: [],
  }
}

/** Everything the logger screen needs: the workout, its sets, the plan, and last time's numbers. */
export async function getWorkoutForLogger(userId: string, logId: string) {
  const log = await ownWorkout(userId, logId)
  const sets = await prisma.vipWorkoutSet.findMany({ where: { logId }, orderBy: [{ setNumber: 'asc' }] })
  const planned = log.programDayId
    ? await prisma.vipProgramPrescription.findMany({
        where: { workout: { dayId: log.programDayId } },
        orderBy: [{ workout: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      })
    : []
  const exerciseIds = [...new Set([...log.exerciseOrder, ...sets.map((s) => s.exerciseId)])]
  const exercises = await prisma.vipExercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, slug: true, name: true, measure: true, muscleGroups: true, equipment: true },
  })
  // "Last time": the sets from the member's most recent finished workout with that exercise.
  const previous: Record<string, { weightKg: number | null; reps: number | null; durationSec: number | null }[]> = {}
  for (const id of exerciseIds) {
    const lastLog = await prisma.vipWorkoutLog.findFirst({
      where: { userId, finishedAt: { not: null }, id: { not: logId }, sets: { some: { exerciseId: id } } },
      orderBy: { finishedAt: 'desc' },
      select: { sets: { where: { exerciseId: id }, orderBy: { setNumber: 'asc' }, select: { weightKg: true, reps: true, durationSec: true } } },
    })
    if (lastLog) previous[id] = lastLog.sets
  }
  const exById = new Map(exercises.map((e) => [e.id, e]))
  return {
    log,
    blocks: exerciseIds
      .map((id) => exById.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({
        exercise: e,
        plan: planned.filter((p) => p.exerciseId === e.id).map((p) => ({ sets: p.sets, reps: p.reps, durationSec: p.durationSec, restSec: p.restSec, notes: p.notes })),
        sets: sets.filter((s) => s.exerciseId === e.id),
        previous: previous[e.id] ?? [],
      })),
  }
}

export async function listHistory(userId: string, take = 30, before?: Date) {
  return prisma.vipWorkoutLog.findMany({
    where: { userId, finishedAt: before ? { lt: before, not: null } : { not: null } },
    orderBy: { finishedAt: 'desc' },
    take: Math.min(take, 100),
    select: { id: true, title: true, finishedAt: true, localDate: true, durationSec: true, totalSets: true, totalVolumeKg: true, pointsAwarded: true },
  })
}

/** Monday of the week containing a local date. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return addDays(date, -((dow + 6) % 7))
}

/** Workouts and volume per week (Monday start) for the last `weeks` weeks, oldest first. */
export async function weeklyTotals(userId: string, today: string, weeks = 12) {
  const first = addDays(weekStart(today), -7 * (weeks - 1))
  const logs = await prisma.vipWorkoutLog.findMany({
    where: { userId, finishedAt: { not: null }, localDate: { gte: first } },
    select: { localDate: true, totalVolumeKg: true },
  })
  const buckets = Array.from({ length: weeks }, (_, i) => ({ week: addDays(first, i * 7), workouts: 0, volumeKg: 0 }))
  for (const l of logs) {
    if (!l.localDate) continue
    const b = buckets.find((x) => x.week === weekStart(l.localDate!))
    if (b) {
      b.workouts += 1
      b.volumeKg += l.totalVolumeKg
    }
  }
  return buckets
}

/** Per-session best for one exercise (for its progress chart), oldest first. */
export async function exerciseProgress(userId: string, exerciseId: string, measure: VipExerciseMeasure, take = 40) {
  const logs = await prisma.vipWorkoutLog.findMany({
    where: { userId, finishedAt: { not: null }, sets: { some: { exerciseId } } },
    orderBy: { finishedAt: 'desc' },
    take,
    select: { localDate: true, finishedAt: true, sets: { where: { exerciseId }, select: { id: true, weightKg: true, reps: true, durationSec: true } } },
  })
  const kind: PrKind = measure === 'WEIGHT_REPS' ? 'EST_1RM' : measure === 'REPS' ? 'MAX_REPS' : 'MAX_DURATION'
  return {
    kind,
    points: logs
      .map((l) => {
        const best = Math.max(0, ...l.sets.map((s) => setValue(kind, s) ?? 0))
        const volumeKg = l.sets.reduce((a, s) => a + setVolumeKg(s), 0)
        return { date: l.localDate ?? l.finishedAt!.toISOString().slice(0, 10), best, volumeKg }
      })
      .filter((p) => p.best > 0)
      .reverse(),
  }
}

export async function personalRecords(userId: string, exerciseId?: string) {
  return prisma.vipPersonalRecord.findMany({
    where: { userId, ...(exerciseId ? { exerciseId } : {}) },
    orderBy: { achievedAt: 'desc' },
    include: { exercise: { select: { id: true, slug: true, name: true, measure: true } } },
  })
}
