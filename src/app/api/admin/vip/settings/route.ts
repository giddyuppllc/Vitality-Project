import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/vip/access'
import { getVipSettings, setVipSettings } from '@/lib/vip/settings'
import { logAudit } from '@/lib/audit'
import { EARNING_MAX, canonicalEarningKey, getEarningRules, setEarningRules, type EarningKey, type EarningRules } from '@/lib/vip/earning'

export const dynamic = 'force-dynamic'

/** GET /api/admin/vip/settings — clubhouse + Zelle-credit settings (with defaults filled in). */
export async function GET() {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  return NextResponse.json({ settings: await getVipSettings() })
}

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const schema = z
  .object({
    'vip.rewardExpiryMonths': z.number().int().min(0).max(120),
    'vip.emailReplyTo': z.string().trim().email().max(200),
    'vip.digestHourUtc': z.number().int().min(0).max(23),
    'vip.timeZone': z.string().trim().max(64).refine(validZone, 'Unknown time zone'),
    'zelle.unpaidExpiryDays': z.number().int().min(0).max(365),
  })
  .partial()

/**
 * Points amounts sent here (older admin forms used this route with keys such
 * as `vip.points.lessonComplete`) are validated against the earning-rules
 * registry and saved there under their canonical key — never as a second
 * copy of the value.
 */
function splitPoints(body: unknown): { rest: unknown; points: Partial<EarningRules> | string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { rest: body, points: {} }
  const rest: Record<string, unknown> = {}
  const points: Partial<EarningRules> = {}
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    const canon = canonicalEarningKey(k)
    if (!canon) {
      rest[k] = v
      continue
    }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > EARNING_MAX[canon]) return { rest, points: `${k} must be a whole number from 0 to ${EARNING_MAX[canon]}` }
    points[canon] = v
  }
  return { rest, points }
}

/** PUT /api/admin/vip/settings — save any subset of the settings. */
export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const { rest, points } = splitPoints(await req.json().catch(() => null))
  if (typeof points === 'string') return NextResponse.json({ error: points }, { status: 400 })
  const parsed = schema.safeParse(rest)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' }, { status: 400 })
  }
  const [before, rulesBefore] = await Promise.all([getVipSettings(), getEarningRules()])
  await setVipSettings(parsed.data)
  await setEarningRules(points)
  const [after, rulesAfter] = await Promise.all([getVipSettings(), getEarningRules()])
  const ruleChanges = Object.fromEntries(
    (Object.keys(points) as EarningKey[]).filter((k) => rulesBefore[k] !== rulesAfter[k]).map((k) => [k, { from: rulesBefore[k], to: rulesAfter[k] }]),
  )
  await logAudit({ userId: gate.userId, action: 'vip.settings', metadata: { before, after, ...(Object.keys(ruleChanges).length ? { earningRules: ruleChanges } : {}) } })
  return NextResponse.json({ ok: true, settings: after, ...(Object.keys(points).length ? { rules: rulesAfter } : {}) })
}
