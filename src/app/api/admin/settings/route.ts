import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * The keys the admin Settings page edits — and the ONLY keys this route will
 * write. site_settings also holds internal state (cron markers, outreach
 * markers, storefront snapshots, tax overrides); the old route upserted any
 * key it was sent, unaudited, including the Zelle payment destination.
 */
const EDITABLE_KEYS = new Set([
  'siteName',
  'siteEmail',
  'affiliateCookieDays',
  'defaultCommissionRate',
  'freeShippingThreshold',
  'maintenanceMode',
  'fulfillmentAutoNotify',
  'zelleEmail',
  'zelleDisplayName',
  'zellePhone',
  'achBankName',
  'achAccountName',
  'achRouting',
  'achAccount',
  'wireBankName',
  'wireBeneficiary',
  'wireAccount',
  'wireRouting',
  'wireSwift',
])

/** Bank account numbers are masked in the audit trail. */
const MASKED_KEYS = new Set(['achAccount', 'wireAccount', 'achRouting', 'wireRouting'])
const mask = (key: string, v: string | null) =>
  v == null ? null : MASKED_KEYS.has(key) && v.length > 4 ? `••••${v.slice(-4)}` : v

const MAX_VALUE_LENGTH = 500

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Send an object of settings' }, { status: 400 })
  }

  const entries = Object.entries(body as Record<string, unknown>)
  const unknown = entries.filter(([k]) => !EDITABLE_KEYS.has(k)).map(([k]) => k)
  if (unknown.length) {
    return NextResponse.json({ error: `Not an editable setting: ${unknown.join(', ')}` }, { status: 400 })
  }
  const values: [string, string][] = []
  for (const [key, raw] of entries) {
    if (raw !== null && typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
      return NextResponse.json({ error: `${key}: must be text` }, { status: 400 })
    }
    const value = raw == null ? '' : String(raw).trim()
    if (value.length > MAX_VALUE_LENGTH) {
      return NextResponse.json({ error: `${key}: too long` }, { status: 400 })
    }
    values.push([key, value])
  }
  if (!values.length) return NextResponse.json({ success: true })

  const before = await prisma.siteSetting.findMany({ where: { key: { in: values.map(([k]) => k) } } })
  const prev = new Map(before.map((s) => [s.key, s.value]))

  await prisma.$transaction(
    values.map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  )

  const changes = values
    .filter(([k, v]) => (prev.get(k) ?? '') !== v)
    .map(([key, v]) => ({ key, from: mask(key, prev.get(key) ?? null), to: mask(key, v) }))
  if (changes.length) {
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'settings.update',
      entityType: 'SiteSetting',
      metadata: { changes },
    })
  }
  return NextResponse.json({ success: true })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const settings = await prisma.siteSetting.findMany({ where: { key: { in: [...EDITABLE_KEYS] } } })
  const result = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  return NextResponse.json(result)
}
