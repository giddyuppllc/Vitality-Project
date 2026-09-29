import { NextRequest, NextResponse } from 'next/server'
import { trackCronRun } from '@/lib/cron-tracker'
import { runMemberRewards } from '@/lib/vip/rewards'

// Cron — deposits each ACTIVE member's monthly clubhouse reward (store credit
// per tier, /admin/vip/rewards; defaults Club $5 / Plus $20 / Premium Stacks
// $50) into the existing StoreCredit ledger, spent at vitalityproject.global
// checkout. Run it DAILY:
//   • on the 1st (UTC) it grants to members ACTIVE that day (not suspended);
//     every other day it grants nothing — `&catchUp=1` grants for the current
//     month if the 1st was missed. Idempotent per member per month.
//   • every day it expires reward credit older than `vip.rewardExpiryMonths`.
//
// `&dryRun=1` returns every decision and writes/sends nothing.
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
  const catchUp = req.nextUrl.searchParams.get('catchUp') === '1'
  return trackCronRun(
    dryRun ? 'VIP member rewards (dry run)' : 'VIP member rewards',
    () => runMemberRewards({ dryRun, catchUp }),
    (r) =>
      `period=${r.period}${r.skipped ? ` skipped=${r.skipped}` : ''} examined=${r.examined} granted=${r.granted} already=${r.alreadyGranted} off=${r.off} suspended=${r.suspended} failed=${r.failed} totalCents=${r.totalCents} emailed=${r.emailed} expiredCents=${r.expiry?.expiredCents ?? 0}`,
  )
}
