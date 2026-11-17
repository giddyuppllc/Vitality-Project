import { NextRequest, NextResponse } from 'next/server'
import { trackCronRun } from '@/lib/cron-tracker'
import { runPointsExpiry } from '@/lib/vip/points-expiry'

// Cron — expires points balances that have had no activity (no earn, spend,
// refund or adjustment) for `vip.points.expiryMonths` months (default 12;
// 0 = never; /admin/vip/rewards/earning). Run DAILY. Exactly once per period
// of inactivity (keyed EXPIRE line, account row locked while re-checked).
//
// `&dryRun=1` lists every balance that would expire and writes nothing.
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
  if (!authorize(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  return trackCronRun(
    dryRun ? 'VIP points expiry (dry run)' : 'VIP points expiry',
    () => runPointsExpiry({ dryRun }),
    (r) =>
      `months=${r.months} examined=${r.examined} expiredAccounts=${r.expiredAccounts} expiredPoints=${r.expiredPoints}${dryRun ? ` wouldExpirePoints=${r.wouldExpirePoints}` : ''}`,
  )
}
