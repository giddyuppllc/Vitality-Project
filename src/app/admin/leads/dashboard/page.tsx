export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { LEAD_STAGES } from '@/components/admin/lead-constants'
import {
  AlertTriangle,
  Check,
  X,
  TrendingUp,
  BarChart2,
} from 'lucide-react'

export default async function LeadDashboardPage() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [
    stageGroups,
    openLeads,
    overdueLeads,
    wonThisMonth,
    lostThisMonth,
    closedLast90,
    wonLast90,
  ] = await Promise.all([
    prisma.salesLead.groupBy({
      by: ['stage'],
      _count: { _all: true },
    }),
    prisma.salesLead.findMany({
      where: {
        stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
      },
      select: {
        id: true,
        estimatedValue: true,
        probability: true,
      },
    }),
    prisma.salesLead.findMany({
      where: {
        nextActionDue: { lt: now },
        stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
      },
      orderBy: { nextActionDue: 'asc' },
      take: 20,
    }),
    prisma.salesLead.count({
      where: { stage: 'CLOSED_WON', closedAt: { gte: startOfMonth } },
    }),
    prisma.salesLead.count({
      where: { stage: 'CLOSED_LOST', closedAt: { gte: startOfMonth } },
    }),
    prisma.salesLead.count({
      where: {
        stage: { in: ['CLOSED_WON', 'CLOSED_LOST'] },
        closedAt: { gte: ninetyDaysAgo },
      },
    }),
    prisma.salesLead.count({
      where: { stage: 'CLOSED_WON', closedAt: { gte: ninetyDaysAgo } },
    }),
  ])

  const totalPipelineCents = openLeads.reduce((sum, l) => {
    const value = l.estimatedValue ?? 0
    const prob = l.probability ?? 0
    return sum + Math.round((value * prob) / 100)
  }, 0)

  const rawPipelineCents = openLeads.reduce(
    (sum, l) => sum + (l.estimatedValue ?? 0),
    0,
  )

  const stageCountMap = new Map<string, number>()
  for (const g of stageGroups) stageCountMap.set(g.stage, g._count._all)

  const conversionRate =
    closedLast90 === 0 ? 0 : Math.round((wonLast90 / closedLast90) * 100)

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-brand-400" /> Pipeline Dashboard
          </h1>
          <p className="text-white/40 mt-1">
            Sales pipeline health at a glance
          </p>
        </div>
        <Link
          href="/admin/leads"
          className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-white/70 text-sm"
        >
          View Kanban
        </Link>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Weighted pipeline</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatPrice(totalPipelineCents)}
          </div>
          <p className="text-[11px] text-white/40 mt-1">
            Raw: {formatPrice(rawPipelineCents)} &middot; sum of estValue ×
            probability
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Won this month</span>
            <Check className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold">{wonThisMonth}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Lost this month</span>
            <X className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-2xl font-bold">{lostThisMonth}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Conversion (90d)</span>
            <TrendingUp className="w-5 h-5 text-brand-400" />
          </div>
          <div className="text-2xl font-bold">{conversionRate}%</div>
          <p className="text-[11px] text-white/40 mt-1">
            {wonLast90} won of {closedLast90} closed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Leads by stage</h2>
          <ul className="space-y-3">
            {LEAD_STAGES.map((s) => {
              const count = stageCountMap.get(s.key) ?? 0
              const max = Math.max(
                ...LEAD_STAGES.map((st) => stageCountMap.get(st.key) ?? 0),
                1,
              )
              return (
                <li key={s.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}
                    >
                      {s.label}
                    </span>
                    <span className="text-sm text-white/70 font-medium">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500/60"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Needs attention — {overdueLeads.length} overdue
          </h2>
          {overdueLeads.length === 0 ? (
            <p className="text-sm text-white/30">
              Nothing overdue. Inbox zero on the pipeline.
            </p>
          ) : (
            <ul className="space-y-3">
              {overdueLeads.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/leads/${l.id}`}
                      className="text-sm font-medium hover:text-brand-400 block truncate"
                    >
                      {l.businessName}
                    </Link>
                    <p className="text-xs text-white/50 truncate">
                      {l.nextAction || 'Action needed'}
                    </p>
                  </div>
                  <span className="text-xs text-red-400 shrink-0">
                    {l.nextActionDue
                      ? new Date(l.nextActionDue).toLocaleDateString()
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
