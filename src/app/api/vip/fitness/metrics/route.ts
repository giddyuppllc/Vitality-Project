import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { fitnessError, fitnessRateLimit, num, readBody, unitsSchema } from '@/lib/vip/fitness/api'
import { resolveTimeZone } from '@/lib/vip/fitness/profile'
import { isValidDate } from '@/lib/vip/fitness/dates'
import { listBodyMetrics, saveBodyMetric } from '@/lib/vip/fitness/health'
import { toCm, toKg } from '@/lib/vip/fitness/units'

export const dynamic = 'force-dynamic'

const schema = z.object({
  date: z.string().refine(isValidDate, 'Pick a valid date'),
  tz: z.string().max(64).optional(),
  units: unitsSchema,
  weight: num(1000),
  bodyFatPct: num(100),
  waist: num(400),
  chest: num(400),
  hips: num(400),
  arm: num(200),
  thigh: num(300),
  notes: z.string().max(1000).nullish(),
})

/** GET — the member's own body metrics (metric units). */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  return vipJson({ metrics: await listBodyMetrics(gate.viewer.userId) })
}

/** PUT — save the entry for a date (lengths/weight in the member's units). */
export async function PUT(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const limited = fitnessRateLimit(gate.viewer.userId)
  if (limited) return limited
  const body = await readBody(req, schema)
  if ('error' in body) return body.error
  const d = body.data
  const cm = (v: number | null | undefined) => (v != null ? toCm(v, d.units) : null)
  try {
    const tz = await resolveTimeZone(gate.viewer.userId, d.tz)
    const row = await saveBodyMetric(gate.viewer.userId, tz, d.date, {
      weightKg: d.weight != null ? toKg(d.weight, d.units) : null,
      bodyFatPct: d.bodyFatPct,
      waistCm: cm(d.waist),
      chestCm: cm(d.chest),
      hipsCm: cm(d.hips),
      armCm: cm(d.arm),
      thighCm: cm(d.thigh),
      notes: d.notes,
    })
    return vipJson({ ok: true, id: row.id })
  } catch (err) {
    return fitnessError(err, 'metrics')
  }
}
