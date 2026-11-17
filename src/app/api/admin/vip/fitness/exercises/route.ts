import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { normaliseTags } from '@/lib/vip/fitness/exercises'
import { AdminInputError, adminError, cleanSlug, id, optionalImage, optionalUrl, parseAdmin } from '@/lib/vip/fitness/admin-api'

export const dynamic = 'force-dynamic'

const tags = z.array(z.string().max(40)).max(12)

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('exercise.upsert'),
    id: id.optional(),
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().max(80).optional(),
    muscleGroups: tags,
    equipment: tags,
    measure: z.enum(['WEIGHT_REPS', 'REPS', 'TIME']),
    instructions: z.string().max(20_000),
    videoUrl: optionalUrl,
    imageUrl: optionalImage,
    published: z.boolean(),
  }),
  z.object({ op: z.literal('exercise.delete'), id }),
])

/** POST /api/admin/vip/fitness/exercises — create / update / delete library exercises. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const body = await parseAdmin(req, schema)
  if ('error' in body) return body.error
  const d = body.data
  let entityId: string | undefined
  try {
    if (d.op === 'exercise.upsert') {
      const slug = cleanSlug(d.slug, d.name)
      const clash = await prisma.vipExercise.findUnique({ where: { slug } })
      if (clash && clash.id !== d.id) throw new AdminInputError('Another exercise already uses that slug', 409)
      const data = {
        name: d.name,
        slug,
        muscleGroups: normaliseTags(d.muscleGroups),
        equipment: normaliseTags(d.equipment),
        measure: d.measure,
        instructions: d.instructions,
        videoUrl: d.videoUrl || null,
        imageUrl: d.imageUrl || null,
        published: d.published,
      }
      const row = d.id ? await prisma.vipExercise.update({ where: { id: d.id }, data }) : await prisma.vipExercise.create({ data })
      entityId = row.id
    } else {
      const [inPrograms, inLogs] = await Promise.all([
        prisma.vipProgramPrescription.count({ where: { exerciseId: d.id } }),
        prisma.vipWorkoutSet.count({ where: { exerciseId: d.id } }),
      ])
      if (inPrograms || inLogs) {
        throw new AdminInputError(
          `In use by ${inPrograms} program prescription(s) and ${inLogs} logged set(s). Unpublish it instead — members' history keeps it.`,
          409,
        )
      }
      await prisma.vipExercise.delete({ where: { id: d.id } })
      entityId = d.id
    }
  } catch (err) {
    return adminError(err, 'exercises')
  }
  await logAudit({ userId: gate.userId, action: `vip.fitness.${d.op}`, entityType: 'VipExercise', entityId })
  return NextResponse.json({ ok: true, id: entityId })
}
