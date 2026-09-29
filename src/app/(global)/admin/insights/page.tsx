export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import {
  computeRFMDistribution,
  SEGMENT_RECOMMENDATIONS,
  type RFMSegment,
} from '@/lib/rfm-scoring'
import { TrendingUp, AlertTriangle, Trophy } from 'lucide-react'

const SEGMENT_META: Record<
  RFMSegment,
  { label: string; color: string; fill: string }
> = {
  CHAMPION: {
    label: 'Champions',
    color: 'text-emerald-400',
    fill: '#34d399',
  },
  LOYAL: { label: 'Loyal', color: 'text-brand-400', fill: '#6270f2' },
  POTENTIAL: {
    label: 'Potential',
    color: 'text-purple-400',
    fill: '#a78bfa',
  },
  AT_RISK: {
    label: 'At risk',
    color: 'text-amber-400',
    fill: '#fbbf24',
  },
  LOST: { label: 'Lost', color: 'text-red-400', fill: '#f87171' },
  NEW: { label: 'New', color: 'text-sky-400', fill: '#38bdf8' },
}

const SEGMENT_ORDER: RFMSegment[] = [
  'CHAMPION',
  'LOYAL',
  'POTENTIAL',
  'NEW',
  'AT_RISK',
  'LOST',
]

export default async function InsightsPage() {
  const data = await computeRFMDistribution()

  const total = data.totalCustomers
  // Build pie slices — stackable with cumulative offsets as stroke-dashoffset
  const radius = 64
  const circumference = 2 * Math.PI * radius
  let cumulative = 0
  const slices = SEGMENT_ORDER.map((seg) => {
    const count = data.distribution[seg]
    const frac = total === 0 ? 0 : count / total
    const length = frac * circumference
    const offset = cumulative
    cumulative += length
    return { seg, count, length, offset }
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-brand-400" /> Customer Insights
        </h1>
        <p className="text-white/40 mt-1">
          RFM-based segmentation across {total.toLocaleString()} paying
          customer{total === 1 ? '' : 's'}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Pie */}
        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <h2 className="font-semibold mb-4">Segment distribution</h2>
          {total === 0 ? (
            <p className="text-sm text-white/30 py-8 text-center">
              No paid orders yet — insights will appear once customers start
              buying.
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 160 160" className="w-48 h-48">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="24"
                />
                {slices.map(({ seg, length, offset }) =>
                  length > 0 ? (
                    <circle
                      key={seg}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke={SEGMENT_META[seg].fill}
                      strokeWidth="24"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 80 80)"
                    />
                  ) : null,
                )}
              </svg>
              <ul className="mt-4 w-full space-y-1.5">
                {SEGMENT_ORDER.map((seg) => {
                  const count = data.distribution[seg]
                  const pct = total === 0 ? 0 : Math.round((count / total) * 100)
                  return (
                    <li
                      key={seg}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ background: SEGMENT_META[seg].fill }}
                        />
                        <span className={SEGMENT_META[seg].color}>
                          {SEGMENT_META[seg].label}
                        </span>
                      </span>
                      <span className="text-white/50">
                        {count} &middot; {pct}%
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Top 10 */}
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" /> Top 10 customers
          </h2>
          {data.top.length === 0 ? (
            <p className="text-sm text-white/30">No customers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-white/40 uppercase tracking-wider">
                  <th className="py-2 pr-2">Customer</th>
                  <th className="py-2 pr-2">Segment</th>
                  <th className="py-2 pr-2">R</th>
                  <th className="py-2 pr-2">F</th>
                  <th className="py-2 pr-2">M</th>
                  <th className="py-2 pr-2">Total</th>
                  <th className="py-2 pr-2 text-right">Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.top.map((c) => (
                  <tr key={c.userId} className="hover:bg-white/2">
                    <td className="py-2 pr-2">
                      <div className="font-medium">
                        {c.name || c.email.split('@')[0]}
                      </div>
                      <div className="text-xs text-white/40">{c.email}</div>
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`text-xs font-medium ${
                          SEGMENT_META[c.score.segment].color
                        }`}
                      >
                        {SEGMENT_META[c.score.segment].label}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-white/70">
                      {c.score.recency}
                    </td>
                    <td className="py-2 pr-2 text-white/70">
                      {c.score.frequency}
                    </td>
                    <td className="py-2 pr-2 text-white/70">
                      {c.score.monetary}
                    </td>
                    <td className="py-2 pr-2 font-semibold">
                      {c.score.total}
                    </td>
                    <td className="py-2 pr-2 text-right font-semibold text-emerald-400">
                      {formatPrice(c.totalSpent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* At-risk */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            At-Risk customers ({data.atRisk.length})
          </h2>
          {data.atRisk.length === 0 ? (
            <p className="text-sm text-white/30">No at-risk customers.</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {data.atRisk.slice(0, 50).map((c) => (
                <li
                  key={c.userId}
                  className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.name || c.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-white/40 truncate">{c.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">
                      {formatPrice(c.totalSpent)}
                    </p>
                    <p className="text-[11px] text-white/40">
                      last:{' '}
                      {new Date(c.lastOrderAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recommendations */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Recommended actions</h2>
          <ul className="space-y-3">
            {SEGMENT_ORDER.map((seg) => (
              <li key={seg} className="border-b border-white/5 pb-3 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: SEGMENT_META[seg].fill }}
                  />
                  <span
                    className={`text-sm font-semibold ${SEGMENT_META[seg].color}`}
                  >
                    {SEGMENT_META[seg].label}
                  </span>
                  <span className="text-xs text-white/40">
                    ({data.distribution[seg]})
                  </span>
                </div>
                <p className="text-xs text-white/60 pl-5">
                  {SEGMENT_RECOMMENDATIONS[seg]}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-xs text-white/30">
            <Link
              href="/admin/leads"
              className="text-brand-400 hover:underline"
            >
              Go to sales pipeline →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
