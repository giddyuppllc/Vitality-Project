import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { membershipRenewalOverdue, membershipSuspended } from '@/lib/email-templates'
import { getZelleIdentity } from '@/lib/zelle'
import { TIER_BENEFITS } from '@/lib/membership'
import { trackCronRun } from '@/lib/cron-tracker'
import { assessMembership, GRACE_DAYS } from '@/lib/membershipLapse'

/**
 * Cron — chase, then pause, a membership whose renewal went unpaid.
 *
 * The gap this closes: nothing ever moved a membership out of ACTIVE. Status
 * only went TO ACTIVE, on mark-paid, so an unpaid renewal left the member with
 * the discount, free shipping and peptide credits indefinitely — and
 * membership-monthly skips anyone already holding an UNPAID invoice, so they
 * were never chased again either.
 *
 * Policy lives in lib/membershipLapse.ts and is a pure function, so it can be
 * exercised against fixed dates. Reminders while in grace, then status flips to
 * PAST_DUE and benefits stop.
 *
 * PAST_DUE is not CANCELLED. Tier and history stay, and mark-paid already sets
 * status back to ACTIVE with a fresh cycle, so paying resumes everything with
 * no extra step.
 *
 * Schedule: daily. Auth: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
 * Dry run: add &dryRun=1 to see the decisions without sending or writing.
 */

const TIER_LABELS: Record<string, string> = {
  CLUB: 'Vitality Club',
  PLUS: 'Vitality Plus',
  PREMIUM: 'Vitality Premium Stacks',
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // fail closed in prod
  const url = new URL(req.url)
  return (
    url.searchParams.get('secret') === secret ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') === secret
  )
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  return trackCronRun(
    dryRun ? 'Membership overdue (dry run)' : 'Membership overdue',
    () => doRun(dryRun),
    r => `examined=${r.examined} reminded=${r.reminded} suspended=${r.suspended} skipped=${r.skipped}`,
  )
}

async function doRun(dryRun: boolean) {
  const now = new Date()

  const candidates = await prisma.membership.findMany({
    where: {
      status: 'ACTIVE',
      tier: { not: 'NONE' },
      renewsAt: { lt: now },
    },
    include: { user: { select: { name: true, email: true } } },
    take: 200,
  })

  let reminded = 0
  let suspended = 0
  let skipped = 0
  const results: Array<Record<string, unknown>> = []
  const zelle = await getZelleIdentity()

  for (const m of candidates) {
    // Is the invoice for this cycle actually unpaid? Someone who has paid but
    // whose renewal date has not moved yet must not be chased.
    let invoiceUnpaid = false
    let invoiceNumber = ''
    let amountCents = m.monthlyPriceCents
    if (m.pendingInvoiceOrderId) {
      const inv = await prisma.order.findUnique({
        where: { id: m.pendingInvoiceOrderId },
        select: { paymentStatus: true, orderNumber: true, total: true },
      })
      if (inv) {
        invoiceUnpaid = inv.paymentStatus === 'UNPAID'
        invoiceNumber = inv.orderNumber
        if (inv.total > 0) amountCents = inv.total
      }
    } else {
      // No invoice was ever raised for this cycle. That is membership-monthly's
      // job, not this one — leave it alone rather than inventing a charge.
      skipped += 1
      results.push({ email: m.user?.email, action: 'skipped', reason: 'no invoice for this cycle' })
      continue
    }

    const decision = assessMembership(
      {
        status: m.status,
        tier: m.tier,
        renewsAt: m.renewsAt,
        invoiceUnpaid,
        lastOverdueNoticeAt: m.lastOverdueNoticeAt,
      },
      now,
    )

    if (decision.action === 'none') {
      skipped += 1
      results.push({ email: m.user?.email, action: 'skipped', reason: decision.reason })
      continue
    }

    const planLabel = TIER_LABELS[m.tier] ?? 'Membership'
    if (amountCents <= 0) {
      amountCents = TIER_BENEFITS[m.tier as keyof typeof TIER_BENEFITS]?.monthlyPriceCents ?? 0
    }
    const email = m.user?.email
    if (!email) {
      skipped += 1
      results.push({ action: 'skipped', reason: 'no email on the account' })
      continue
    }

    if (decision.action === 'remind') {
      results.push({
        email,
        action: 'remind',
        tier: m.tier,
        daysOverdue: decision.daysOverdue,
        daysLeftInGrace: decision.daysLeftInGrace,
      })
      if (!dryRun) {
        const tpl = membershipRenewalOverdue({
          name: m.user?.name ?? null,
          planLabel,
          amountCents,
          invoiceNumber,
          daysOverdue: decision.daysOverdue,
          daysLeftInGrace: decision.daysLeftInGrace,
          zelle,
        })
        await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        await prisma.membership.update({
          where: { id: m.id },
          data: { lastOverdueNoticeAt: now },
        })
      }
      reminded += 1
      continue
    }

    // suspend
    results.push({ email, action: 'suspend', tier: m.tier, daysOverdue: decision.daysOverdue })
    if (!dryRun) {
      // Benefits stop the moment status leaves ACTIVE — getUserMembership()
      // resolves tier to NONE, and pricing/checkout gate on the same check.
      // Unused credits for the unpaid cycle are cleared so a later payment
      // grants a clean allotment rather than stacking.
      await prisma.membership.update({
        where: { id: m.id },
        data: {
          status: 'PAST_DUE',
          lastOverdueNoticeAt: now,
          freePeptideCreditsThisPeriod: 0,
          freePeptidesUsedThisPeriod: 0,
          freeSuppliesClaimedThisPeriod: false,
        },
      })
      const tpl = membershipSuspended({
        name: m.user?.name ?? null,
        planLabel,
        amountCents,
        invoiceNumber,
        daysOverdue: decision.daysOverdue,
        zelle,
      })
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
    }
    suspended += 1
  }

  return {
    ok: true as const,
    dryRun,
    graceDays: GRACE_DAYS,
    examined: candidates.length,
    reminded,
    suspended,
    skipped,
    results,
  }
}
