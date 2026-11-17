import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { EARNING_KEYS, EARNING_MAX, getEarningRules, setEarningRules, type EarningKey } from '@/lib/vip/earning'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  return NextResponse.json({ rules: await getEarningRules() })
}

const schema = z
  .object(Object.fromEntries(EARNING_KEYS.map((k) => [k, z.number().int().min(0).max(EARNING_MAX[k]).optional()])) as Record<EarningKey, z.ZodOptional<z.ZodNumber>>)
  .strict()

/** PUT /api/admin/vip/rewards/earning — earning rules (whole numbers ≥ 0, each within its bound). */
export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Values must be whole numbers within their limits.' }, { status: 400 })
  const before = await getEarningRules()
  await setEarningRules(parsed.data)
  const after = await getEarningRules()
  const changes = Object.fromEntries(EARNING_KEYS.filter((k) => before[k] !== after[k]).map((k) => [k, { from: before[k], to: after[k] }]))
  await logAudit({ userId: gate.userId, action: 'vip.rewards.earning_rules', metadata: { changes } })
  return NextResponse.json({ ok: true, rules: after })
}
