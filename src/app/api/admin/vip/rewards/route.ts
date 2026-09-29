import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { getTierRewardSettings } from '@/lib/vip/rewards'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  return NextResponse.json({ settings: await getTierRewardSettings() })
}

// Cents, per tier, per month. 0 = off. Upper bound is a typo guard only.
const cents = z.number().int().min(0).max(1_000_000)
const schema = z.object({ CLUB: cents, PLUS: cents, PREMIUM: cents })

/** PUT /api/admin/vip/rewards — set each tier's monthly store-credit grant. */
export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Amounts must be whole cents ≥ 0' }, { status: 400 })
  const before = await getTierRewardSettings()
  for (const tier of ['CLUB', 'PLUS', 'PREMIUM'] as const) {
    await prisma.vipTierReward.upsert({
      where: { tier },
      update: { monthlyCreditCents: parsed.data[tier], updatedById: gate.userId },
      create: { tier, monthlyCreditCents: parsed.data[tier], updatedById: gate.userId },
    })
  }
  await logAudit({
    userId: gate.userId,
    action: 'vip.rewards.settings',
    metadata: { before, after: parsed.data },
  })
  return NextResponse.json({ ok: true, settings: parsed.data })
}
