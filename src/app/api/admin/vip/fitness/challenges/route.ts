import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { isValidDate } from '@/lib/vip/fitness/dates'
import { evaluateChallenge } from '@/lib/vip/fitness/challenges'
import { AdminInputError, adminError, cleanSlug, id, optionalImage, parseAdmin, tier } from '@/lib/vip/fitness/admin-api'

export const dynamic = 'force-dynamic'

const date = z.string().refine(isValidDate, 'Use a valid date (YYYY-MM-DD)')

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('challenge.upsert'),
    id: id.optional(),
    title: z.string().trim().min(1).max(160),
    slug: z.string().trim().max(80).optional(),
    description: z.string().max(20_000).default(''),
    coverImage: optionalImage,
    metric: z.enum(['WORKOUTS', 'STEPS', 'CHECKIN_STREAK', 'CUSTOM_POINTS']),
    target: z.number().int().min(1).max(100_000_000),
    startDate: date,
    endDate: date,
    minTier: tier,
    pointsReward: z.number().int().min(0).max(100_000),
    badgeLabel: z.string().trim().max(120).nullish(),
    published: z.boolean(),
  }),
  z.object({ op: z.literal('challenge.delete'), id }),
  z.object({ op: z.literal('participant.score'), challengeId: id, userId: id, score: z.number().int().min(0).max(100_000_000) }),
  z.object({ op: z.literal('challenge.evaluate'), id }),
])

/**
 * POST /api/admin/vip/fitness/challenges — create / edit / delete challenges,
 * enter coach scores (CUSTOM_POINTS), re-check completions.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const body = await parseAdmin(req, schema)
  if ('error' in body) return body.error
  const d = body.data
  let entityId: string | undefined
  let completed = 0
  try {
    switch (d.op) {
      case 'challenge.upsert': {
        if (d.endDate < d.startDate) throw new AdminInputError('The end date is before the start date')
        const slug = cleanSlug(d.slug, d.title)
        const clash = await prisma.vipChallenge.findUnique({ where: { slug } })
        if (clash && clash.id !== d.id) throw new AdminInputError('Another challenge already uses that slug', 409)
        const data = {
          title: d.title,
          slug,
          description: d.description,
          coverImage: d.coverImage || null,
          metric: d.metric,
          target: d.target,
          startDate: d.startDate,
          endDate: d.endDate,
          minTier: d.minTier,
          pointsReward: d.pointsReward,
          badgeLabel: d.badgeLabel || null,
          published: d.published,
        }
        if (d.id) {
          const prev = await prisma.vipChallenge.findUnique({ where: { id: d.id }, select: { metric: true, _count: { select: { participants: true } } } })
          if (prev && prev.metric !== d.metric && prev._count.participants > 0) {
            throw new AdminInputError('Members have joined — the metric can no longer change. Create a new challenge instead.', 409)
          }
        }
        const row = d.id ? await prisma.vipChallenge.update({ where: { id: d.id }, data }) : await prisma.vipChallenge.create({ data })
        entityId = row.id
        completed = await evaluateChallenge(row.id)
        break
      }
      case 'challenge.delete':
        await prisma.vipChallenge.delete({ where: { id: d.id } })
        entityId = d.id
        break
      case 'participant.score': {
        const c = await prisma.vipChallenge.findUnique({ where: { id: d.challengeId }, select: { metric: true } })
        if (!c) throw new AdminInputError('Challenge not found', 404)
        if (c.metric !== 'CUSTOM_POINTS') throw new AdminInputError('Scores are entered by hand only on coach-scored challenges')
        await prisma.vipChallengeParticipant.update({
          where: { challengeId_userId: { challengeId: d.challengeId, userId: d.userId } },
          data: { customScore: d.score },
        })
        entityId = d.challengeId
        completed = await evaluateChallenge(d.challengeId)
        break
      }
      case 'challenge.evaluate':
        entityId = d.id
        completed = await evaluateChallenge(d.id)
        break
    }
  } catch (err) {
    return adminError(err, 'challenges')
  }
  await logAudit({
    userId: gate.userId,
    action: `vip.fitness.${d.op}`,
    entityType: 'VipChallenge',
    entityId,
    metadata: d.op === 'participant.score' ? { userId: d.userId, score: d.score } : undefined,
  })
  return NextResponse.json({ ok: true, id: entityId, completed })
}
