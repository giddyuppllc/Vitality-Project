import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/vip/access'
import { csvResponse } from '@/lib/csv'
import { logAudit } from '@/lib/audit'
import { generateStatements, issueStatement, settleStatement, statementLinesCsv, statementsCsv } from '@/lib/vip/statements'
import { rewardsErrorResponse } from '@/lib/vip/rewards-api'

export const dynamic = 'force-dynamic'

/**
 * GET — CSV export:
 *   ?period=YYYY-MM   every partner's statement for that month
 *   ?id=<statement>   one statement
 *   ?lines=<statement> the transactions behind one statement
 *   (none)            every statement
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const sp = req.nextUrl.searchParams
  try {
    const lines = sp.get('lines')
    if (lines) {
      const { csv, filename } = await statementLinesCsv(lines)
      await logAudit({ userId: gate.userId, action: 'vip.partner.statement.export', entityType: 'VipPartnerStatement', entityId: lines, metadata: { lines: true } })
      return csvResponse(csv, filename)
    }
    const period = sp.get('period') ?? undefined
    if (period && !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: 'Period must be YYYY-MM' }, { status: 400 })
    const id = sp.get('id') ?? undefined
    const csv = await statementsCsv({ period, id })
    await logAudit({ userId: gate.userId, action: 'vip.partner.statement.export', entityType: 'VipPartnerStatement', entityId: id ?? null, metadata: { period: period ?? null } })
    return csvResponse(csv, `partner-statements${period ? `-${period}` : ''}${id ? `-${id}` : ''}.csv`)
  } catch (e) {
    return rewardsErrorResponse(e, true)
  }
}

const schema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('generate'), period: z.string().regex(/^\d{4}-\d{2}$/), dryRun: z.boolean().optional(), partnerId: z.string().optional() }),
  z.object({ op: z.literal('issue'), id: z.string().min(1) }),
  z.object({ op: z.literal('settle'), id: z.string().min(1), settlementRef: z.string().trim().min(1).max(120) }),
])

/** POST — generate drafts (dryRun supported) / issue / mark settled with the Zelle reference. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const d = parsed.data
  try {
    if (d.op === 'generate') {
      return NextResponse.json(await generateStatements({ period: d.period, dryRun: d.dryRun, partnerId: d.partnerId, actorUserId: gate.userId }))
    }
    if (d.op === 'issue') return NextResponse.json({ ok: true, statement: await issueStatement(d.id, gate.userId) })
    return NextResponse.json({ ok: true, statement: await settleStatement(d.id, gate.userId, d.settlementRef) })
  } catch (e) {
    return rewardsErrorResponse(e, true)
  }
}
