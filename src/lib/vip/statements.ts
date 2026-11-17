import type { VipPartnerStatement } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { toCsv } from '@/lib/csv'
import { pointsToCents } from './points'
import { periodFor } from './rewards'
import { RewardsError, isUniqueViolation } from './rewards-errors'

/**
 * Monthly partner statements (UTC calendar months).
 *
 *   turnover          Σ member purchases recorded at the partner (EARN, not voided)
 *   network fee       turnover × the partner's fee % (rounded to the cent)
 *   points issued     Σ points awarded on those purchases — the network's
 *                     liability for them, shown at 100 points = $1
 *   points redeemed   Σ points members spent at the partner (REDEEM, not voided);
 *                     their value is owed TO the partner
 *   net               fee − redeemed value. > 0: the partner pays the network;
 *                     < 0: the network pays the partner.
 *
 * Points issued are reported as the network's liability but are NOT billed to
 * the partner: the network fee is what funds them (an assumption to confirm
 * with Kevin — see docs/VIP_CLUBHOUSE.md).
 *
 * Statuses: DRAFT (recomputed on every generate) → ISSUED (frozen) → SETTLED
 * (an admin records the Zelle reference; the app never moves money).
 */

export interface StatementMath {
  turnoverCents: number
  feeBps: number
  feeCents: number
  pointsIssued: number
  pointsIssuedCents: number
  pointsRedeemed: number
  pointsRedeemedCents: number
  netCents: number
  earnCount: number
  redeemCount: number
}

export function computeStatement(
  txns: { kind: 'EARN' | 'REDEEM'; amountCents: number; points: number; voidedAt: Date | null }[],
  feeBps: number,
): StatementMath {
  let turnoverCents = 0
  let pointsIssued = 0
  let pointsRedeemed = 0
  let earnCount = 0
  let redeemCount = 0
  for (const t of txns) {
    if (t.voidedAt) continue
    if (t.kind === 'EARN') {
      turnoverCents += t.amountCents
      pointsIssued += t.points
      earnCount++
    } else {
      pointsRedeemed += t.points
      redeemCount++
    }
  }
  const feeCents = Math.round((turnoverCents * feeBps) / 10_000)
  const pointsRedeemedCents = pointsToCents(pointsRedeemed)
  return {
    turnoverCents,
    feeBps,
    feeCents,
    pointsIssued,
    pointsIssuedCents: pointsToCents(pointsIssued),
    pointsRedeemed,
    pointsRedeemedCents,
    netCents: feeCents - pointsRedeemedCents,
    earnCount,
    redeemCount,
  }
}

export function periodRange(period: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new RewardsError('bad_period', 'Period must be YYYY-MM.', 400)
  const y = Number(m[1])
  const mo = Number(m[2])
  return { start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 1)) }
}

export function previousPeriod(now = new Date()): string {
  return periodFor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)))
}

export type GenerateDecision = {
  partnerId: string
  partner: string
  outcome: 'created' | 'updated' | 'unchanged_issued' | 'would_create' | 'would_update' | 'skipped_issued'
  math: StatementMath
}

/**
 * Generate (or refresh) DRAFT statements for `period` — every partner with
 * activity that month, plus every active partner (a zero statement is still a
 * statement). ISSUED/SETTLED statements are never touched. dryRun writes
 * nothing and returns the figures.
 */
export async function generateStatements(opts: { period: string; dryRun?: boolean; partnerId?: string; actorUserId?: string | null }) {
  const { start, end } = periodRange(opts.period)
  if (start.getTime() > Date.now()) throw new RewardsError('future_period', 'That month has not started yet.', 400)
  const partners = await prisma.vipPartner.findMany({
    where: opts.partnerId
      ? { id: opts.partnerId }
      : { OR: [{ active: true }, { txns: { some: { createdAt: { gte: start, lt: end } } } }] },
    orderBy: { name: 'asc' },
  })
  const decisions: GenerateDecision[] = []
  for (const p of partners) {
    const txns = await prisma.vipPartnerTxn.findMany({
      where: { partnerId: p.id, createdAt: { gte: start, lt: end } },
      select: { kind: true, amountCents: true, points: true, voidedAt: true },
    })
    const existing = await prisma.vipPartnerStatement.findUnique({ where: { partnerId_period: { partnerId: p.id, period: opts.period } } })
    // A draft always uses the partner's current fee; issued ones keep theirs.
    const math = computeStatement(txns, existing && existing.status !== 'DRAFT' ? existing.feeBps : p.networkFeeBps)
    if (existing && existing.status !== 'DRAFT') {
      decisions.push({ partnerId: p.id, partner: p.name, outcome: opts.dryRun ? 'skipped_issued' : 'unchanged_issued', math })
      continue
    }
    if (opts.dryRun) {
      decisions.push({ partnerId: p.id, partner: p.name, outcome: existing ? 'would_update' : 'would_create', math })
      continue
    }
    await prisma.vipPartnerStatement
      .upsert({
        where: { partnerId_period: { partnerId: p.id, period: opts.period } },
        create: { partnerId: p.id, period: opts.period, ...math, generatedAt: new Date() },
        update: {},
      })
      .catch((e) => {
        if (!isUniqueViolation(e)) throw e // a concurrent generate created it — fine
      })
    // Conditional on still being a draft (an issue racing this generate wins).
    await prisma.vipPartnerStatement.updateMany({
      where: { partnerId: p.id, period: opts.period, status: 'DRAFT' },
      data: { ...math, generatedAt: new Date() },
    })
    decisions.push({ partnerId: p.id, partner: p.name, outcome: existing ? 'updated' : 'created', math })
  }
  if (!opts.dryRun) {
    await logAudit({
      userId: opts.actorUserId ?? null,
      action: 'vip.partner.statements.generate',
      entityType: 'VipPartnerStatement',
      metadata: { period: opts.period, partners: decisions.length, partnerId: opts.partnerId ?? null },
    })
  }
  return { period: opts.period, dryRun: !!opts.dryRun, decisions }
}

export async function issueStatement(id: string, adminId: string): Promise<VipPartnerStatement> {
  const s = await prisma.vipPartnerStatement.findUnique({ where: { id } })
  if (!s) throw new RewardsError('not_found', 'Statement not found.', 404)
  if (s.status !== 'DRAFT') throw new RewardsError('bad_status', 'Only a draft statement can be issued.', 409)
  // Issuing a month that is still running would freeze it early.
  if (periodRange(s.period).end.getTime() > Date.now()) {
    throw new RewardsError('period_open', 'This month is still running — issue it after it ends.', 409)
  }
  // Refresh the figures one last time, then freeze them.
  await generateStatements({ period: s.period, partnerId: s.partnerId, actorUserId: adminId })
  const { count } = await prisma.vipPartnerStatement.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'ISSUED', issuedAt: new Date() } })
  if (count !== 1) throw new RewardsError('bad_status', 'Only a draft statement can be issued.', 409)
  const out = await prisma.vipPartnerStatement.findUniqueOrThrow({ where: { id } })
  await logAudit({ userId: adminId, action: 'vip.partner.statement.issue', entityType: 'VipPartnerStatement', entityId: id, metadata: { period: s.period, netCents: out.netCents } })
  return out
}

export async function settleStatement(id: string, adminId: string, zelleRef: string): Promise<VipPartnerStatement> {
  const ref = zelleRef.trim()
  if (!ref || ref.length > 120) throw new RewardsError('ref_required', 'Enter the Zelle reference.', 400)
  const { count } = await prisma.vipPartnerStatement.updateMany({
    where: { id, status: 'ISSUED' },
    data: { status: 'SETTLED', settledAt: new Date(), settlementRef: ref, settledById: adminId },
  })
  if (count !== 1) throw new RewardsError('bad_status', 'Only an issued statement can be marked settled.', 409)
  const out = await prisma.vipPartnerStatement.findUniqueOrThrow({ where: { id } })
  await logAudit({
    userId: adminId,
    action: 'vip.partner.statement.settle',
    entityType: 'VipPartnerStatement',
    entityId: id,
    metadata: { period: out.period, netCents: out.netCents, settlementRef: ref },
  })
  return out
}

// Numbers, not strings: the CSV escaper only neutralises text, and a negative
// amount must stay a number (not become the text "'-12.50").
const dollars = (c: number) => Number((c / 100).toFixed(2))

/** CSV of statements (formula-injection-safe via lib/csv escapeCsvCell). */
export async function statementsCsv(where: { period?: string; id?: string }): Promise<string> {
  const rows = await prisma.vipPartnerStatement.findMany({
    where: { ...(where.period ? { period: where.period } : {}), ...(where.id ? { id: where.id } : {}) },
    include: { partner: { select: { name: true, slug: true } } },
    orderBy: [{ period: 'desc' }, { partner: { name: 'asc' } }],
  })
  return toCsv(
    rows.map((s) => ({
      period: s.period,
      partner: s.partner.name,
      partner_slug: s.partner.slug,
      status: s.status,
      member_turnover_usd: dollars(s.turnoverCents),
      network_fee_pct: (s.feeBps / 100).toFixed(2),
      network_fee_usd: dollars(s.feeCents),
      points_issued: s.pointsIssued,
      points_issued_liability_usd: dollars(s.pointsIssuedCents),
      points_redeemed: s.pointsRedeemed,
      points_redeemed_owed_to_partner_usd: dollars(s.pointsRedeemedCents),
      net_usd: dollars(s.netCents),
      direction: s.netCents > 0 ? 'partner pays network' : s.netCents < 0 ? 'network pays partner' : 'nothing due',
      purchases: s.earnCount,
      redemptions: s.redeemCount,
      issued_at: s.issuedAt?.toISOString() ?? '',
      settled_at: s.settledAt?.toISOString() ?? '',
      zelle_reference: s.settlementRef ?? '',
    })),
    [
      'period', 'partner', 'partner_slug', 'status', 'member_turnover_usd', 'network_fee_pct', 'network_fee_usd', 'points_issued',
      'points_issued_liability_usd', 'points_redeemed', 'points_redeemed_owed_to_partner_usd', 'net_usd', 'direction', 'purchases',
      'redemptions', 'issued_at', 'settled_at', 'zelle_reference',
    ],
  )
}

/** Line items behind one statement (CSV), for the partner's own reconciliation. */
export async function statementLinesCsv(id: string): Promise<{ csv: string; filename: string }> {
  const s = await prisma.vipPartnerStatement.findUnique({ where: { id }, include: { partner: { select: { slug: true, name: true } } } })
  if (!s) throw new RewardsError('not_found', 'Statement not found.', 404)
  const { start, end } = periodRange(s.period)
  const txns = await prisma.vipPartnerTxn.findMany({ where: { partnerId: s.partnerId, createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'asc' } })
  const cards = await prisma.vipMemberCard.findMany({ where: { userId: { in: [...new Set(txns.map((t) => t.memberUserId))] } } })
  const num = new Map(cards.map((c) => [c.userId, c.memberNumber]))
  const csv = toCsv(
    txns.map((t) => ({
      date_utc: t.createdAt.toISOString(),
      type: t.kind === 'EARN' ? 'purchase' : 'points spent',
      member_number: num.get(t.memberUserId) ?? '',
      receipt: t.receiptRef ?? '',
      amount_usd: dollars(t.amountCents),
      points: t.points,
      voided: t.voidedAt ? 'yes' : '',
      void_reason: t.voidReason ?? '',
    })),
    ['date_utc', 'type', 'member_number', 'receipt', 'amount_usd', 'points', 'voided', 'void_reason'],
  )
  return { csv, filename: `statement-${s.partner.slug}-${s.period}.csv` }
}

/** Cron: on the 1st (UTC) generate last month's drafts. `period` overrides. */
export async function runStatementsCron(opts: { now?: Date; dryRun?: boolean; period?: string; force?: boolean }) {
  const now = opts.now ?? new Date()
  if (!opts.period && !opts.force && now.getUTCDate() !== 1) {
    return { ok: true, skipped: 'not_the_1st', period: previousPeriod(now), decisions: [] as GenerateDecision[] }
  }
  const period = opts.period ?? previousPeriod(now)
  const r = await generateStatements({ period, dryRun: opts.dryRun })
  return { ok: true, skipped: null, ...r }
}
