import { NextRequest, NextResponse } from 'next/server'
import { trackCronRun } from '@/lib/cron-tracker'
import { runVipNotify } from '@/lib/vip/mailer'

// Cron — clubhouse email + calendar upkeep. Run every 15 minutes:
//   • publishes the next occurrence of each monthly event series
//   • event reminders to members who RSVP'd (24 h and 1 h before, once each)
//   • the daily reply/mention digest (once a day, from `vip.digestHourUtc`)
// Every send is claimed before it is sent, so overlapping runs never double-send.
// `&dryRun=1` reports what would happen and writes/sends nothing.
// Auth: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET> (same as every cron here).

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // fail closed in prod; bypass only in dev
  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret')
  const headerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return querySecret === secret || headerSecret === secret
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  return trackCronRun(
    dryRun ? 'VIP notify (dry run)' : 'VIP notify',
    () => runVipNotify({ dryRun }),
    (r) =>
      `series=${r.series.created.length} reminders24h=${r.reminders.sent24h} reminders1h=${r.reminders.sent1h} digest=${r.digest.sent}${r.digest.skipped ? `(${r.digest.skipped})` : ''} failed=${r.reminders.failed + r.digest.failed}`,
  )
}
