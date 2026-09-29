import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/vip/access'
import { getVipSettings, setVipSettings } from '@/lib/vip/settings'
import { logAudit } from '@/lib/audit'

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

/** PUT /api/admin/vip/settings — save any subset of the settings. */
export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' }, { status: 400 })
  }
  const before = await getVipSettings()
  await setVipSettings(parsed.data)
  const after = await getVipSettings()
  await logAudit({ userId: gate.userId, action: 'vip.settings', metadata: { before, after } })
  return NextResponse.json({ ok: true, settings: after })
}
