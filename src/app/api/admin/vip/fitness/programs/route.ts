import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { AdminInputError, adminError, cleanSlug, id, optionalImage, parseAdmin, sort, tier } from '@/lib/vip/fitness/admin-api'

export const dynamic = 'force-dynamic'

const text = (max: number) => z.string().trim().max(max).nullish()

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('program.upsert'),
    id: id.optional(),
    title: z.string().trim().min(1).max(160),
    slug: z.string().trim().max(80).optional(),
    summary: text(2000),
    description: z.string().max(20_000).default(''),
    coverImage: optionalImage,
    level: text(40),
    minTier: tier,
    published: z.boolean(),
    sortOrder: sort,
  }),
  z.object({ op: z.literal('program.delete'), id }),
  z.object({
    op: z.literal('week.upsert'),
    id: id.optional(),
    programId: id,
    weekNumber: z.number().int().min(1).max(104).optional(),
    title: text(160),
    notes: text(4000),
  }),
  z.object({ op: z.literal('week.delete'), id }),
  z.object({ op: z.literal('week.duplicate'), id }),
  z.object({
    op: z.literal('day.upsert'),
    id: id.optional(),
    weekId: id,
    dayNumber: z.number().int().min(1).max(14).optional(),
    title: z.string().trim().min(1).max(160),
    notes: text(4000),
    isRest: z.boolean().default(false),
  }),
  z.object({ op: z.literal('day.delete'), id }),
  z.object({
    op: z.literal('workout.upsert'),
    id: id.optional(),
    dayId: id,
    title: z.string().trim().min(1).max(160),
    notes: text(4000),
    sortOrder: sort,
  }),
  z.object({ op: z.literal('workout.delete'), id }),
  z.object({
    op: z.literal('prescription.upsert'),
    id: id.optional(),
    workoutId: id,
    exerciseId: id,
    sets: z.number().int().min(1).max(20),
    reps: text(40),
    durationSec: z.number().int().min(1).max(4 * 3600).nullish(),
    restSec: z.number().int().min(0).max(1800).nullish(),
    notes: text(1000),
  }),
  z.object({ op: z.literal('prescription.delete'), id }),
  z.object({ op: z.literal('prescription.move'), id, dir: z.enum(['up', 'down']) }),
])

/**
 * POST /api/admin/vip/fitness/programs — the program builder:
 * program → weeks → days → workouts → exercise prescriptions.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const body = await parseAdmin(req, schema)
  if ('error' in body) return body.error
  const d = body.data
  let entityId: string | undefined

  try {
    switch (d.op) {
      case 'program.upsert': {
        const slug = cleanSlug(d.slug, d.title)
        const clash = await prisma.vipProgram.findUnique({ where: { slug } })
        if (clash && clash.id !== d.id) throw new AdminInputError('Another program already uses that slug', 409)
        const data = {
          title: d.title,
          slug,
          summary: d.summary || null,
          description: d.description,
          coverImage: d.coverImage || null,
          level: d.level || null,
          minTier: d.minTier,
          published: d.published,
          sortOrder: d.sortOrder ?? 0,
        }
        entityId = (d.id ? await prisma.vipProgram.update({ where: { id: d.id }, data }) : await prisma.vipProgram.create({ data })).id
        break
      }
      case 'program.delete':
        await prisma.vipProgram.delete({ where: { id: d.id } })
        entityId = d.id
        break
      case 'week.upsert': {
        if (d.id) {
          entityId = (
            await prisma.vipProgramWeek.update({
              where: { id: d.id },
              data: { title: d.title || null, notes: d.notes || null, ...(d.weekNumber ? { weekNumber: d.weekNumber } : {}) },
            })
          ).id
        } else {
          const last = await prisma.vipProgramWeek.findFirst({ where: { programId: d.programId }, orderBy: { weekNumber: 'desc' } })
          entityId = (
            await prisma.vipProgramWeek.create({
              data: { programId: d.programId, weekNumber: d.weekNumber ?? (last?.weekNumber ?? 0) + 1, title: d.title || null, notes: d.notes || null },
            })
          ).id
        }
        break
      }
      case 'week.delete':
        await prisma.vipProgramWeek.delete({ where: { id: d.id } })
        entityId = d.id
        break
      case 'week.duplicate': {
        const src = await prisma.vipProgramWeek.findUnique({
          where: { id: d.id },
          include: { days: { include: { workouts: { include: { prescriptions: true } } } } },
        })
        if (!src) throw new AdminInputError('Week not found', 404)
        const last = await prisma.vipProgramWeek.findFirst({ where: { programId: src.programId }, orderBy: { weekNumber: 'desc' } })
        const week = await prisma.vipProgramWeek.create({
          data: {
            programId: src.programId,
            weekNumber: (last?.weekNumber ?? 0) + 1,
            title: src.title,
            notes: src.notes,
            days: {
              create: src.days.map((day) => ({
                dayNumber: day.dayNumber,
                title: day.title,
                notes: day.notes,
                isRest: day.isRest,
                workouts: {
                  create: day.workouts.map((w) => ({
                    title: w.title,
                    notes: w.notes,
                    sortOrder: w.sortOrder,
                    prescriptions: {
                      create: w.prescriptions.map((p) => ({
                        exerciseId: p.exerciseId,
                        sortOrder: p.sortOrder,
                        sets: p.sets,
                        reps: p.reps,
                        durationSec: p.durationSec,
                        restSec: p.restSec,
                        notes: p.notes,
                      })),
                    },
                  })),
                },
              })),
            },
          },
        })
        entityId = week.id
        break
      }
      case 'day.upsert': {
        const data = { title: d.title, notes: d.notes || null, isRest: d.isRest }
        if (d.id) {
          entityId = (await prisma.vipProgramDay.update({ where: { id: d.id }, data: { ...data, ...(d.dayNumber ? { dayNumber: d.dayNumber } : {}) } })).id
        } else {
          const last = await prisma.vipProgramDay.findFirst({ where: { weekId: d.weekId }, orderBy: { dayNumber: 'desc' } })
          const dayNumber = d.dayNumber ?? (last?.dayNumber ?? 0) + 1
          if (dayNumber > 14) throw new AdminInputError('A week holds at most 14 days')
          entityId = (await prisma.vipProgramDay.create({ data: { ...data, weekId: d.weekId, dayNumber } })).id
        }
        break
      }
      case 'day.delete':
        await prisma.vipProgramDay.delete({ where: { id: d.id } })
        entityId = d.id
        break
      case 'workout.upsert': {
        const data = { title: d.title, notes: d.notes || null, sortOrder: d.sortOrder ?? 0 }
        entityId = (
          d.id
            ? await prisma.vipProgramWorkout.update({ where: { id: d.id }, data })
            : await prisma.vipProgramWorkout.create({ data: { ...data, dayId: d.dayId } })
        ).id
        break
      }
      case 'workout.delete':
        await prisma.vipProgramWorkout.delete({ where: { id: d.id } })
        entityId = d.id
        break
      case 'prescription.upsert': {
        const ex = await prisma.vipExercise.findUnique({ where: { id: d.exerciseId }, select: { id: true } })
        if (!ex) throw new AdminInputError('Pick an exercise from the library')
        const data = {
          exerciseId: d.exerciseId,
          sets: d.sets,
          reps: d.reps || null,
          durationSec: d.durationSec ?? null,
          restSec: d.restSec ?? null,
          notes: d.notes || null,
        }
        if (d.id) {
          entityId = (await prisma.vipProgramPrescription.update({ where: { id: d.id }, data })).id
        } else {
          const last = await prisma.vipProgramPrescription.findFirst({ where: { workoutId: d.workoutId }, orderBy: { sortOrder: 'desc' } })
          entityId = (
            await prisma.vipProgramPrescription.create({ data: { ...data, workoutId: d.workoutId, sortOrder: (last?.sortOrder ?? -1) + 1 } })
          ).id
        }
        break
      }
      case 'prescription.delete':
        await prisma.vipProgramPrescription.delete({ where: { id: d.id } })
        entityId = d.id
        break
      case 'prescription.move': {
        const p = await prisma.vipProgramPrescription.findUnique({ where: { id: d.id } })
        if (!p) throw new AdminInputError('Not found', 404)
        const siblings = await prisma.vipProgramPrescription.findMany({
          where: { workoutId: p.workoutId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        })
        const ids = siblings.map((s) => s.id)
        const i = ids.indexOf(p.id)
        const j = d.dir === 'up' ? i - 1 : i + 1
        if (j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]]
        await prisma.$transaction(ids.map((pid, n) => prisma.vipProgramPrescription.update({ where: { id: pid }, data: { sortOrder: n } })))
        entityId = p.id
        break
      }
    }
  } catch (err) {
    return adminError(err, 'programs')
  }
  await logAudit({ userId: gate.userId, action: `vip.fitness.${d.op}`, entityType: 'VipProgram', entityId })
  return NextResponse.json({ ok: true, id: entityId })
}
