import { NextRequest, NextResponse } from 'next/server'
import { trackCronRun } from '@/lib/cron-tracker'
import { runStatementsCron } from '@/lib/vip/statements'

// Cron — partner network statements. Run DAILY: on the 1st (UTC) it generates
// DRAFT statements for the month that just ended (every active partner, plus
// any partner with activity that month); other days it does nothing.
// Re-running refreshes drafts; issued/settled statements are never touched.
//
// `&dryRun=1` returns the figures and writes nothing. `&period=YYYY-MM`
// generates that month on any day.
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
  const sp = req.nextUrl.searchParams
  const dryRun = sp.get('dryRun') === '1'
  const period = sp.get('period') ?? undefined
  if (period && !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 })
  return trackCronRun(
    dryRun ? 'VIP partner statements (dry run)' : 'VIP partner statements',
    () => runStatementsCron({ dryRun, period }),
    (r) => `period=${r.period}${r.skipped ? ` skipped=${r.skipped}` : ''} partners=${r.decisions.length}`,
  )
}
