import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { trackCronRun } from '@/lib/cron-tracker'
import { logAudit } from '@/lib/audit'
import { CampaignAlreadySendingError, sendCampaign } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'

/**
 * Sends marketing campaigns whose Schedule time has arrived.
 *
 * The admin campaign builder's "Schedule" button set status SCHEDULED, but
 * nothing ever sent a scheduled campaign. This job does — it must be added to
 * the box's crontab (e.g. every 10 min):
 *   GET /api/cron/scheduled-campaigns?secret=<CRON_SECRET>
 *
 * Safe to re-run: sendCampaign claims each campaign atomically (SCHEDULED ->
 * SENDING) and skips anyone already mailed for it.
 */
async function runJob() {
  const due = await prisma.marketingCampaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() }, channel: 'EMAIL' },
    select: { id: true, name: true },
    orderBy: { scheduledAt: 'asc' },
    take: 5,
  })
  let sent = 0
  let campaigns = 0
  let errors = 0
  for (const c of due) {
    try {
      const r = await sendCampaign(c.id)
      campaigns += 1
      sent += r.sent
      await logAudit({
        action: 'campaign.send',
        entityType: 'MarketingCampaign',
        entityId: c.id,
        metadata: { sent: r.sent, skipped: r.skipped, source: 'cron/scheduled-campaigns' },
      })
    } catch (err) {
      if (err instanceof CampaignAlreadySendingError) continue
      errors += 1
      console.error(`[scheduled-campaigns] ${c.id} failed:`, err)
      // Leave it SCHEDULED for the next run (recipients already mailed are skipped).
      await prisma.marketingCampaign
        .updateMany({ where: { id: c.id, status: 'SENDING' }, data: { status: 'SCHEDULED' } })
        .catch(() => {})
    }
  }
  return { due: due.length, campaigns, sent, errors }
}

export async function GET(req: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 503 })
  }
  if (req.nextUrl.searchParams.get('secret') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return trackCronRun(
    'Scheduled campaigns',
    async () => ({ ok: true, ...(await runJob()) }),
    (r) => `due=${r.due} campaigns=${r.campaigns} sent=${r.sent} errors=${r.errors}`,
  )
}
