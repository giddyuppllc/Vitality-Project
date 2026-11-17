import type { MembershipTier, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierAllows } from '@/lib/vip/access'
import { awardPoints, type Tx } from '@/lib/vip/points'
import { getFitnessPoints } from './settings'

/**
 * Coach-authored training programs: program → weeks → days → workouts →
 * exercise prescriptions. Gated per program by minimum tier, exactly like
 * classroom courses (unpublished = doesn't exist; below the tier = the
 * outline only, never the prescriptions).
 *
 * Progress is SEQUENTIAL, not calendar-bound: "today's workout" is the first
 * day of the program the member hasn't completed yet, so a missed Tuesday
 * never skips a session. Rest days are marked done with one tap.
 */

export const PROGRAM_TREE = {
  weeks: {
    orderBy: { weekNumber: 'asc' },
    include: {
      days: {
        orderBy: { dayNumber: 'asc' },
        include: {
          workouts: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              prescriptions: {
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                include: { exercise: { select: { id: true, slug: true, name: true, measure: true, published: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.VipProgramInclude

export type ProgramTree = Prisma.VipProgramGetPayload<{ include: typeof PROGRAM_TREE }>
export type ProgramDayFull = ProgramTree['weeks'][number]['days'][number]

/** Days in program order with their week number. */
export function orderedDays(p: ProgramTree): (ProgramDayFull & { weekNumber: number; weekTitle: string | null })[] {
  return p.weeks.flatMap((w) => w.days.map((d) => ({ ...d, weekNumber: w.weekNumber, weekTitle: w.title })))
}

async function orderedDayIds(programId: string, tx: Tx = prisma): Promise<string[]> {
  const weeks = await tx.vipProgramWeek.findMany({
    where: { programId },
    orderBy: { weekNumber: 'asc' },
    select: { days: { orderBy: { dayNumber: 'asc' }, select: { id: true } } },
  })
  return weeks.flatMap((w) => w.days.map((d) => d.id))
}

export async function listPrograms(userId: string, accessTier: MembershipTier) {
  const [programs, enrollments] = await Promise.all([
    prisma.vipProgram.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { weeks: { select: { days: { select: { id: true, isRest: true } } } } },
    }),
    prisma.vipProgramEnrollment.findMany({
      where: { userId },
      include: { _count: { select: { completions: true } } },
    }),
  ])
  const byProgram = new Map(enrollments.map((e) => [e.programId, e]))
  return programs.map((p) => {
    const days = p.weeks.flatMap((w) => w.days)
    const e = byProgram.get(p.id)
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      coverImage: p.coverImage,
      level: p.level,
      minTier: p.minTier,
      allowed: tierAllows(accessTier, p.minTier),
      weekCount: p.weeks.length,
      dayCount: days.length,
      trainingDays: days.filter((d) => !d.isRest).length,
      enrollment: e ? { status: e.status, completed: Math.min(e._count.completions, days.length) } : null,
    }
  })
}

export async function getProgram(slug: string, userId: string, accessTier: MembershipTier) {
  const program = await prisma.vipProgram.findUnique({ where: { slug }, include: PROGRAM_TREE })
  if (!program || !program.published) return null
  const allowed = tierAllows(accessTier, program.minTier)
  const enrollment = await prisma.vipProgramEnrollment.findUnique({
    where: { userId_programId: { userId, programId: program.id } },
    include: { completions: { select: { dayId: true } } },
  })
  const done = new Set(enrollment?.completions.map((c) => c.dayId) ?? [])
  const days = orderedDays(program)
  const next = days.find((d) => !done.has(d.id)) ?? null
  if (!allowed) {
    // Outline only: the prescriptions are withheld below the tier.
    for (const w of program.weeks) for (const d of w.days) d.workouts = []
  }
  return { program, allowed, enrollment, done, nextDayId: next?.id ?? null, totalDays: days.length }
}

export class ProgramError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** Gate for a program the member wants to use. */
async function usableProgram(programId: string, accessTier: MembershipTier) {
  const p = await prisma.vipProgram.findUnique({ where: { id: programId } })
  if (!p || !p.published) throw new ProgramError('Program not found', 404)
  if (!tierAllows(accessTier, p.minTier)) throw new ProgramError('This program needs a higher membership tier', 403)
  return p
}

/**
 * Start (or resume) a program. One program is ACTIVE at a time: any other
 * active program is paused with its progress kept. A completed program can
 * be started again from day one (`restart`); its completion points are not
 * paid twice (the award key is per member per program).
 */
export async function enroll(userId: string, programId: string, accessTier: MembershipTier, opts: { restart?: boolean } = {}) {
  await usableProgram(programId, accessTier)
  const dayIds = await orderedDayIds(programId)
  if (dayIds.length === 0) throw new ProgramError('This program has no days yet', 409)
  return prisma.$transaction(async (tx) => {
    await tx.vipProgramEnrollment.updateMany({
      where: { userId, status: 'ACTIVE', programId: { not: programId } },
      data: { status: 'PAUSED' },
    })
    const existing = await tx.vipProgramEnrollment.findUnique({ where: { userId_programId: { userId, programId } } })
    if (!existing) {
      return tx.vipProgramEnrollment.create({ data: { userId, programId } })
    }
    if (existing.status === 'COMPLETED' || opts.restart) {
      await tx.vipProgramDayCompletion.deleteMany({ where: { enrollmentId: existing.id } })
      return tx.vipProgramEnrollment.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', startedAt: new Date(), completedAt: null },
      })
    }
    return tx.vipProgramEnrollment.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } })
  })
}

export async function pauseProgram(userId: string, programId: string) {
  const { count } = await prisma.vipProgramEnrollment.updateMany({
    where: { userId, programId, status: 'ACTIVE' },
    data: { status: 'PAUSED' },
  })
  return count > 0
}

/**
 * Mark a program day done. Idempotent (unique enrollment+day). When it was
 * the last open day, the enrollment completes and the program-complete
 * points are awarded exactly once.
 */
export async function completeProgramDay(
  args: { userId: string; enrollmentId: string; dayId: string; workoutLogId?: string | null },
): Promise<{ programCompleted: boolean; points: number }> {
  const enrollment = await prisma.vipProgramEnrollment.findUnique({
    where: { id: args.enrollmentId },
    include: { program: { select: { id: true, title: true } } },
  })
  if (!enrollment || enrollment.userId !== args.userId) throw new ProgramError('Not enrolled', 404)
  const dayIds = await orderedDayIds(enrollment.programId)
  if (!dayIds.includes(args.dayId)) throw new ProgramError('That day is not part of this program', 400)

  await prisma.vipProgramDayCompletion.upsert({
    where: { enrollmentId_dayId: { enrollmentId: enrollment.id, dayId: args.dayId } },
    create: { enrollmentId: enrollment.id, dayId: args.dayId, workoutLogId: args.workoutLogId ?? null },
    update: {},
  })
  const done = await prisma.vipProgramDayCompletion.count({ where: { enrollmentId: enrollment.id, dayId: { in: dayIds } } })
  if (done < dayIds.length) return { programCompleted: false, points: 0 }

  const { count } = await prisma.vipProgramEnrollment.updateMany({
    where: { id: enrollment.id, status: { not: 'COMPLETED' } },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })
  const amount = (await getFitnessPoints())['vip.fitness.points.programComplete']
  let points = 0
  if (amount > 0) {
    const r = await awardPoints({
      userId: args.userId,
      points: amount,
      type: 'EARN_ENGAGEMENT',
      description: `Program completed: ${enrollment.program.title}`.slice(0, 190),
      idempotencyKey: `program-complete:${args.userId}:${enrollment.programId}`,
    })
    if (!r.duplicate) points = amount
  }
  return { programCompleted: count > 0, points }
}

/** Rest day: one tap to mark it done and move on. */
export async function completeRestDay(userId: string, programId: string, dayId: string, accessTier: MembershipTier) {
  await usableProgram(programId, accessTier)
  const enrollment = await prisma.vipProgramEnrollment.findUnique({ where: { userId_programId: { userId, programId } } })
  if (!enrollment || enrollment.status === 'COMPLETED') throw new ProgramError('Start the program first', 409)
  const day = await prisma.vipProgramDay.findUnique({ where: { id: dayId } })
  if (!day?.isRest) throw new ProgramError('Only rest days can be marked done without a workout', 400)
  return completeProgramDay({ userId, enrollmentId: enrollment.id, dayId })
}

/**
 * The member's active program and the next day to train, with its workouts.
 * null when no program is active. `locked` when the member's tier no longer
 * covers the program (e.g. downgraded) — the day's content is withheld.
 */
export async function getTodaysWorkout(userId: string, accessTier: MembershipTier) {
  const enrollment = await prisma.vipProgramEnrollment.findFirst({
    where: { userId, status: 'ACTIVE', program: { published: true } },
    orderBy: { updatedAt: 'desc' },
    include: { program: { include: PROGRAM_TREE }, completions: { select: { dayId: true } } },
  })
  if (!enrollment) return null
  const program = enrollment.program
  const allowed = tierAllows(accessTier, program.minTier)
  const days = orderedDays(program)
  const done = new Set(enrollment.completions.map((c) => c.dayId))
  const index = days.findIndex((d) => !done.has(d.id))
  const day = index >= 0 ? days[index] : null
  return {
    enrollmentId: enrollment.id,
    program: { id: program.id, slug: program.slug, title: program.title, minTier: program.minTier },
    allowed,
    day: day && allowed ? day : day ? { ...day, workouts: [] } : null,
    position: day ? { index: index + 1, total: days.length, week: day.weekNumber } : null,
    completedDays: days.filter((d) => done.has(d.id)).length,
    totalDays: days.length,
  }
}
