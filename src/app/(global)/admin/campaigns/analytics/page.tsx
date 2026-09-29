import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import {
  ArrowLeft,
  Mail,
  MailOpen,
  MousePointerClick,
  DollarSign,
  TrendingUp,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CampaignsAnalyticsPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [sentLast30d, allSent, topByRevenue, recentMessages] = await Promise.all([
    prisma.marketingCampaign.findMany({
      where: {
        status: 'SENT',
        sentAt: { gte: thirtyDaysAgo },
      },
      orderBy: { sentAt: 'desc' },
    }),
    prisma.marketingCampaign.aggregate({
      where: { status: 'SENT' },
      _sum: {
        recipientCount: true,
        deliveredCount: true,
        openedCount: true,
        clickedCount: true,
        revenueCents: true,
        conversions: true,
      },
    }),
    prisma.marketingCampaign.findMany({
      where: { status: 'SENT' },
      orderBy: { revenueCents: 'desc' },
      take: 5,
    }),
    prisma.outboundMessage.findMany({
      where: {
        campaignId: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
        openedAt: true,
        clickedAt: true,
      },
    }),
  ])

  const totalSent30d = sentLast30d.reduce((sum, c) => sum + c.recipientCount, 0)
  const delivered30d = sentLast30d.reduce((sum, c) => sum + c.deliveredCount, 0)
  const opened30d = sentLast30d.reduce((sum, c) => sum + c.openedCount, 0)
  const clicked30d = sentLast30d.reduce((sum, c) => sum + c.clickedCount, 0)
  const revenue30d = sentLast30d.reduce((sum, c) => sum + c.revenueCents, 0)

  const avgOpenRate =
    delivered30d > 0 ? Math.round((opened30d / delivered30d) * 100) : 0
  const avgClickRate =
    delivered30d > 0 ? Math.round((clicked30d / delivered30d) * 100) : 0

  // Build a 30-day bucket series
  const days: Array<{ date: string; sent: number; opened: number; clicked: number }> = []
  const dayMap = new Map<string, { sent: number; opened: number; clicked: number }>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    const bucket = { sent: 0, opened: 0, clicked: 0 }
    dayMap.set(key, bucket)
    days.push({ date: key, ...bucket })
  }
  for (const m of recentMessages) {
    const sentKey = m.createdAt.toISOString().slice(0, 10)
    const b = dayMap.get(sentKey)
    if (b) b.sent++
    if (m.openedAt) {
      const ok = m.openedAt.toISOString().slice(0, 10)
      const ob = dayMap.get(ok)
      if (ob) ob.opened++
    }
    if (m.clickedAt) {
      const ck = m.clickedAt.toISOString().slice(0, 10)
      const cb = dayMap.get(ck)
      if (cb) cb.clicked++
    }
  }
  // sync mutated values
  for (const d of days) {
    const b = dayMap.get(d.date)
    if (b) {
      d.sent = b.sent
      d.opened = b.opened
      d.clicked = b.clicked
    }
  }
  const maxVal = Math.max(
    1,
    ...days.map((d) => Math.max(d.sent, d.opened, d.clicked)),
  )

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/campaigns"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Campaign analytics</h1>
          <p className="text-white/40 mt-1">Marketing performance over the last 30 days</p>
        </div>
      </div>

      {/* 30-day KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          {
            label: 'Sent (30d)',
            value: totalSent30d.toLocaleString(),
            icon: Mail,
            color: 'text-brand-400',
          },
          {
            label: 'Avg open rate',
            value: `${avgOpenRate}%`,
            icon: MailOpen,
            color: 'text-emerald-400',
          },
          {
            label: 'Avg click rate',
            value: `${avgClickRate}%`,
            icon: MousePointerClick,
            color: 'text-purple-400',
          },
          {
            label: 'Revenue attributed (30d)',
            value: formatPrice(revenue30d),
            icon: DollarSign,
            color: 'text-emerald-400',
          },
        ].map((card) => (
          <div key={card.label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/40">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Opens/clicks over time — simple bar chart */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-400" /> Opens &amp; clicks (last 30d)
          </h2>
          <div className="flex items-end gap-0.5 h-40 w-full">
            {days.map((d) => {
              const openH = (d.opened / maxVal) * 100
              const clickH = (d.clicked / maxVal) * 100
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col justify-end gap-0.5 group relative"
                  title={`${d.date} — opens ${d.opened} · clicks ${d.clicked} · sent ${d.sent}`}
                >
                  <div
                    className="bg-emerald-500/60 rounded-t-sm"
                    style={{ height: `${openH}%` }}
                  />
                  <div
                    className="bg-purple-500/60 rounded-t-sm"
                    style={{ height: `${clickH}%` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-white/50">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-500/60" /> Opens
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-purple-500/60" /> Clicks
            </span>
          </div>
        </div>

        {/* Lifetime totals */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Lifetime totals</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-white/5">
              <dt className="text-white/40">Total recipients</dt>
              <dd className="font-medium">
                {(allSent._sum.recipientCount ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <dt className="text-white/40">Total delivered</dt>
              <dd className="font-medium">
                {(allSent._sum.deliveredCount ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <dt className="text-white/40">Total opens</dt>
              <dd className="font-medium">
                {(allSent._sum.openedCount ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <dt className="text-white/40">Total clicks</dt>
              <dd className="font-medium">
                {(allSent._sum.clickedCount ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <dt className="text-white/40">Total conversions</dt>
              <dd className="font-medium">
                {(allSent._sum.conversions ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-white/40">Total revenue</dt>
              <dd className="font-bold text-emerald-400">
                {formatPrice(allSent._sum.revenueCents ?? 0)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Top campaigns by revenue */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-semibold">Top campaigns by revenue</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {['Campaign', 'Sent', 'Opens', 'Clicks', 'Conversions', 'Revenue'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {topByRevenue.map((c) => (
              <tr key={c.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/campaigns/${c.id}`}
                    className="font-medium text-white hover:text-brand-400"
                  >
                    {c.name}
                  </Link>
                  {c.sentAt && (
                    <p className="text-xs text-white/40 mt-0.5">
                      {formatDate(c.sentAt)}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3 text-sm">
                  {c.recipientCount.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-sm">{c.openedCount.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm">{c.clickedCount.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm">{c.conversions.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm font-bold text-emerald-400">
                  {formatPrice(c.revenueCents)}
                </td>
              </tr>
            ))}
            {topByRevenue.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-white/30 text-sm">
                  No sent campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
