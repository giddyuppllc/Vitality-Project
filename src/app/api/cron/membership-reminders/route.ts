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
  if (!secret) return process.env.NODE_ENV !== 'production' // fail closed in prod; bypass only in dev
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
      `examined=${r.examined} sent=${r.sent} closed=${r.closed} skipped=${r.skipped} failed=${r.failed}`,
  )
}

/** Days after signup on which an unpaid signup is nudged, then silence. */
const REMINDER_DAYS = [2, 5, 10] as const

/**
 * Days after signup before an unpaid signup is closed.
 *
 * This is not a new policy — the reminder email has been telling people
 * "pending signups auto-close after 14 days" since it was written, and nothing
 * ever closed one. Seven signups were sitting at 33 to 99 days still marked
 * PENDING_PAYMENT, so the statement was simply untrue.
 *
 * Closing is reversible and costs the member nothing: PENDING_PAYMENT grants no
 * benefits, and if they pay later mark-paid sets the membership straight back
 * to ACTIVE. Only signups that actually received a reminder are closed — nobody
 * is closed without having been told.
 */
const AUTOCLOSE_AFTER_DAYS = 14

async function doRun() {
  const now = Date.now()
  const twoDaysAgo = new Date(now - 2 * 86400e3)
  const oneDayAgo = new Date(now - 1 * 86400e3)

  const pending = await prisma.membership.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      // Never chase a free-tier member for payment — there is nothing to pay.
      tier: { not: 'NONE' },
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
    // Reminders at 2d, 5d and 10d, then quiet.
    //
    // These used to be exact one-day windows (>= 2 && < 3). A run that missed
    // its day — a deploy, an outage, a slow night — skipped that reminder
    // permanently, because the next run saw day 3 and matched nothing. The
    // schedule now advances off the LAST reminder actually sent, so a missed
    // day is caught up on the following run instead of being lost.
    const dayOfLastReminder = m.lastReminderSentAt
      ? Math.floor((m.lastReminderSentAt.getTime() - m.startedAt.getTime()) / 86400e3)
      : -1
    const nextDue = REMINDER_DAYS.find((d) => d > dayOfLastReminder)
    const inBucket = nextDue !== undefined && daysWaiting >= nextDue
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

  // ── Close signups that were reminded and still never paid ────────────────
  let closed = 0
  const closeCutoff = new Date(now - AUTOCLOSE_AFTER_DAYS * 86400e3)
  const stale = await prisma.membership.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      tier: { not: 'NONE' },
      startedAt: { lte: closeCutoff },
      // Never close someone who was never told. Every reminder stamps this.
      lastReminderSentAt: { not: null },
    },
    select: { id: true, tier: true, startedAt: true, pendingInvoiceOrderId: true },
    take: 100,
  })

  for (const m of stale) {
    const daysWaiting = Math.floor((now - m.startedAt.getTime()) / 86400e3)
    try {
      await prisma.membership.update({
        where: { id: m.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), pendingInvoiceOrderId: null },
      })
      // Take the dead invoice out of the payment-reminder queue with it,
      // rather than leaving an UNPAID/PENDING order chasing a closed signup.
      if (m.pendingInvoiceOrderId) {
        await prisma.order.updateMany({
          where: { id: m.pendingInvoiceOrderId, paymentStatus: 'UNPAID' },
          data: { status: 'CANCELLED' },
        })
      }
      closed += 1
      results.push({ membershipId: m.id, email: '(auto-closed)', status: 'skipped', error: `closed after ${daysWaiting}d unpaid` })
    } catch (err) {
      failed += 1
      results.push({ membershipId: m.id, email: '(auto-close failed)', status: 'failed', error: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    ok: true as const,
    examined: pending.length,
    sent,
    skipped,
    closed,
    failed,
    results,
  }
}
