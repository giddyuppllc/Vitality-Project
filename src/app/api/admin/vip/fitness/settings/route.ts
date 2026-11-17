import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { FITNESS_POINT_KEYS, MAX_POINTS_SETTING, getFitnessPoints, setFitnessPoints, type FitnessPoints } from '@/lib/vip/fitness/settings'
import { parseAdmin } from '@/lib/vip/fitness/admin-api'

export const dynamic = 'force-dynamic'

const schema = z.object(
  Object.fromEntries(FITNESS_POINT_KEYS.map((k) => [k, z.number().int().min(0).max(MAX_POINTS_SETTING).optional()])) as Record<
    keyof FitnessPoints,
    z.ZodOptional<z.ZodNumber>
  >,
)

/** GET/PUT /api/admin/vip/fitness/settings — points for workouts, check-ins, streaks, programs. */
export async function GET() {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  return NextResponse.json(await getFitnessPoints())
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const body = await parseAdmin(req, schema)
  if ('error' in body) return body.error
  const before = await getFitnessPoints()
  await setFitnessPoints(body.data as Partial<FitnessPoints>)
  const after = await getFitnessPoints()
  await logAudit({ userId: gate.userId, action: 'vip.fitness.settings.update', entityType: 'SiteSetting', metadata: { before, after } })
  return NextResponse.json(after)
}
