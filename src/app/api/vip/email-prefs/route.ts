import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { checkRateLimit } from '@/lib/rate-limit'
import { KIND_FIELDS, verifyPrefToken } from '@/lib/vip/email-prefs'

export const dynamic = 'force-dynamic'

const SELECT = { emailDigest: true, emailEvents: true, emailRewards: true } as const

/** GET /api/vip/email-prefs — the signed-in member's clubhouse email preferences. */
export async function GET() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const p = await prisma.vipProfile.findUnique({ where: { userId: gate.viewer.userId }, select: SELECT })
  return vipJson({ prefs: p ?? { emailDigest: true, emailEvents: true, emailRewards: true } })
}

const patchSchema = z.object({
  emailDigest: z.boolean().optional(),
  emailEvents: z.boolean().optional(),
  emailRewards: z.boolean().optional(),
})

/** PATCH /api/vip/email-prefs — signed-in member toggles their clubhouse emails. */
export async function PATCH(req: NextRequest) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid preferences' }, { status: 400 })
  const prefs = await prisma.vipProfile.upsert({
    where: { userId: gate.viewer.userId },
    update: parsed.data,
    create: { userId: gate.viewer.userId, ...parsed.data },
    select: SELECT,
  })
  return vipJson({ ok: true, prefs })
}

const tokenSchema = z.object({ u: z.string().min(1).max(64), k: z.string().max(16), t: z.string().max(128) })

/**
 * POST /api/vip/email-prefs — one-click opt-out from an email link (no
 * session needed; the HMAC token proves the link came from our email).
 */
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 'vip-email-prefs', { limit: 20, windowMs: 60_000 })
  if (!limited.allowed) return vipJson({ error: 'Too many requests' }, { status: 429 })
  const parsed = tokenSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !verifyPrefToken(parsed.data.u, parsed.data.k, parsed.data.t)) {
    return vipJson({ error: 'This link is not valid. Manage email from your Clubhouse profile.' }, { status: 403 })
  }
  const { u, k } = parsed.data
  const user = await prisma.user.findUnique({ where: { id: u }, select: { id: true } })
  if (!user) return vipJson({ error: 'Not found' }, { status: 404 })
  const data =
    k === 'all'
      ? { emailDigest: false, emailEvents: false, emailRewards: false }
      : { [KIND_FIELDS[k as keyof typeof KIND_FIELDS]]: false }
  await prisma.vipProfile.upsert({ where: { userId: u }, update: data, create: { userId: u, ...data } })
  return vipJson({ ok: true })
}
