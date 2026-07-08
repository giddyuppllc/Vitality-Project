import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { membershipSignupReminder } from '@/lib/email-templates'
import { getZelleIdentity } from '@/lib/zelle'
import { TIER_BENEFITS } from '@/lib/membership'
import { trackCronRun } from '@/lib/cron-tracker'

// Cron — nudges users who signed up for a membership but haven't sent the
// Zelle payment yet. Sends at 2d, 5d, 10d after signup. Skips members whose
// status is anything but PENDING_PAYMENT.
//
// Schedule: daily. Idempotent via Membership.lastReminderSentAt — we only
// fire if the next bucket has been reached AND no reminder went out in the
// last 24h.
//
// Auth: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.

const TIER_LABELS = {
  CLUB: 'Vitality Club',
  PLUS: 'Vitality Plus',
  PREMIUM: 'Vitality Premium Stacks',
} as const

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret')
  const headerSecret = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
  return querySecret === secret || headerSecret === secret
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return trackCronRun(
    'Membership reminders',
    () => doRun(),
    (r) =>
      `examined=${r.examined} sent=${r.sent} skipped=${r.skipped} failed=${r.failed}`,
  )
}

async function doRun() {
  const now = Date.now()
  const twoDaysAgo = new Date(now - 2 * 86400e3)
  const oneDayAgo = new Date(now - 1 * 86400e3)

  const pending = await prisma.membership.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      startedAt: { lte: twoDaysAgo },
      OR: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lte: oneDayAgo } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    take: 100,
  })

  let sent = 0
  let skipped = 0
  let failed = 0
  const results: Array<{
    membershipId: string
    email: string
    status: 'sent' | 'skipped' | 'failed'
    error?: string
  }> = []

  const zelle = await getZelleIdentity()

  for (const m of pending) {
    if (!m.user.email) {
      skipped += 1
      results.push({ membershipId: m.id, email: '(no email)', status: 'skipped' })
      continue
    }
    if (!m.pendingInvoiceOrderId) {
      skipped += 1
      results.push({
        membershipId: m.id,
        email: m.user.email,
        status: 'skipped',
        error: 'no pending invoice',
      })
      continue
    }
    const invoice = await prisma.order.findUnique({
      where: { id: m.pendingInvoiceOrderId },
      select: { orderNumber: true, paymentStatus: true },
    })
    if (!invoice || invoice.paymentStatus !== 'UNPAID') {
      skipped += 1
      results.push({
        membershipId: m.id,
        email: m.user.email,
        status: 'skipped',
        error: 'invoice not unpaid',
      })
      continue
    }

    const daysWaiting = Math.floor((now - m.startedAt.getTime()) / 86400e3)
    // Bucket: 2d, 5d, 10d, then quiet. Skip if outside buckets.
    const inBucket =
      (daysWaiting >= 2 && daysWaiting < 3) ||
      (daysWaiting >= 5 && daysWaiting < 6) ||
      (daysWaiting >= 10 && daysWaiting < 11)
    if (!inBucket) {
      skipped += 1
      results.push({
        membershipId: m.id,
        email: m.user.email,
        status: 'skipped',
        error: `day ${daysWaiting} not in bucket`,
      })
      continue
    }

    const planLabel =
      TIER_LABELS[m.tier as keyof typeof TIER_LABELS] ?? 'Membership'
    const amountCents =
      m.monthlyPriceCents > 0
        ? m.monthlyPriceCents
        : TIER_BENEFITS[m.tier as 'CLUB' | 'PLUS' | 'PREMIUM']
            ?.monthlyPriceCents ?? 0

    const tpl = membershipSignupReminder({
      name: m.user.name,
      planLabel,
      amountCents,
      invoiceNumber: invoice.orderNumber,
      signedUpAt: m.startedAt,
      daysWaiting,
      zelle,
    })

    try {
      const r = await sendEmail({
        to: m.user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      })
      if (r.success) {
        await prisma.membership.update({
          where: { id: m.id },
          data: { lastReminderSentAt: new Date() },
        })
        sent += 1
        results.push({
          membershipId: m.id,
          email: m.user.email,
          status: 'sent',
        })
      } else {
        failed += 1
        results.push({
          membershipId: m.id,
          email: m.user.email,
          status: 'failed',
          error: r.error,
        })
      }
    } catch (err) {
      failed += 1
      results.push({
        membershipId: m.id,
        email: m.user.email,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    ok: true as const,
    examined: pending.length,
    sent,
    skipped,
    failed,
    results,
  }
}
