import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { awardPoints, spendPoints, InsufficientPointsError } from '@/lib/vip/points'
import { findUserIdByMemberNumber } from '@/lib/vip/member-card'

export const dynamic = 'force-dynamic'

async function resolveUser(q: string): Promise<string | null> {
  const s = q.trim()
  if (!s) return null
  if (s.includes('@')) return (await prisma.user.findUnique({ where: { email: s.toLowerCase() }, select: { id: true } }))?.id
    ?? (await prisma.user.findFirst({ where: { email: { equals: s, mode: 'insensitive' } }, select: { id: true } }))?.id
    ?? null
  return findUserIdByMemberNumber(s)
}

/** GET ?q=<email or member number> — balance + recent ledger for one member. */
export async function GET(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const userId = await resolveUser(req.nextUrl.searchParams.get('q') ?? '')
  if (!userId) return NextResponse.json({ error: 'No member found' }, { status: 404 })
  const acct = await prisma.loyaltyAccount.findUnique({
    where: { userId },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
  })
  return NextResponse.json({ userId, points: acct?.points ?? 0, transactions: acct?.transactions ?? [] })
}

const schema = z.object({
  member: z.string().trim().min(3).max(200), // email or member number
  points: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000, 'Points must be non-zero and at most 1,000,000'),
  reason: z.string().trim().min(3).max(500),
  // One per press of "Apply": a repeated submit is the same adjustment.
  clickKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
})

/** POST — manual adjustment (ADJUST, reason required, audit-logged; a deduction never overdraws). */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { member, points, reason, clickKey } = parsed.data
  const userId = await resolveUser(member)
  if (!userId) return NextResponse.json({ error: 'No member found for that email or member number.' }, { status: 404 })
  const idempotencyKey = `adjust:${gate.userId}:${clickKey}`
  try {
    const r =
      points > 0
        ? await awardPoints({ userId, points, type: 'ADJUST', description: reason, idempotencyKey, source: 'admin' })
        : await spendPoints({ userId, points: -points, type: 'ADJUST', description: reason, idempotencyKey, source: 'admin' })
    if (!r.duplicate) {
      await logAudit({
        userId: gate.userId,
        action: 'vip.points.adjust',
        entityType: 'LoyaltyTransaction',
        entityId: r.transactionId,
        metadata: { memberUserId: userId, points, reason, balance: r.balance },
      })
    }
    return NextResponse.json({ ok: true, duplicate: r.duplicate, balance: r.balance })
  } catch (e) {
    if (e instanceof InsufficientPointsError) {
      return NextResponse.json({ error: 'The member’s balance is lower than that deduction.' }, { status: 409 })
    }
    throw e
  }
}
