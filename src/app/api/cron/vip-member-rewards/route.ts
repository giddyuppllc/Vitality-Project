import { NextRequest, NextResponse } from 'next/server'
import { trackCronRun } from '@/lib/cron-tracker'
import { runMemberRewards } from '@/lib/vip/rewards'

// Cron — deposits each ACTIVE member's monthly clubhouse reward (admin-set
// store credit per tier, /admin/vip/rewards) into the existing StoreCredit
// ledger, spent at vitalityproject.global checkout.
//
// DEFAULT OFF: every tier's amount is 0 until an admin sets one, and a 0 tier
// grants nothing. Idempotent per member per calendar month (UTC): run it daily
// — the first run in a month grants, every later run that month is a no-op.
//
// `&dryRun=1` returns every decision and writes nothing.
// Auth: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET> (same as every cron here).

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
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  return trackCronRun(
    dryRun ? 'VIP member rewards (dry run)' : 'VIP member rewards',
    () => runMemberRewards({ dryRun }),
    (r) =>
      `period=${r.period} examined=${r.examined} granted=${r.granted} already=${r.alreadyGranted} off=${r.off} failed=${r.failed} totalCents=${r.totalCents}`,
  )
}
