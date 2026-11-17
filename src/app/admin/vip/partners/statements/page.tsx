import Link from 'next/link'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { previousPeriod } from '@/lib/vip/statements'
import { periodFor } from '@/lib/vip/rewards'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'
import { StatementGenerator } from '@/components/admin/vip/rewards-forms'

export const dynamic = 'force-dynamic'

const API = '/api/admin/vip/partners/statements'
const currentPeriod = () => periodFor(new Date())

export default async function AdminStatementsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdminPage()
  const { period } = await searchParams
  const filter = period && /^\d{4}-\d{2}$/.test(period) ? period : undefined
  const [rows, periods] = await Promise.all([
    prisma.vipPartnerStatement.findMany({
      where: filter ? { period: filter } : {},
      orderBy: [{ period: 'desc' }, { partner: { name: 'asc' } }],
      take: 200,
      include: { partner: { select: { name: true } } },
    }),
    prisma.vipPartnerStatement.findMany({ distinct: ['period'], select: { period: true }, orderBy: { period: 'desc' }, take: 24 }),
  ])
  const totals = rows.reduce(
    (t, s) => ({ fee: t.fee + s.feeCents, redeemed: t.redeemed + s.pointsRedeemedCents, net: t.net + s.netCents, issued: t.issued + s.pointsIssuedCents }),
    { fee: 0, redeemed: 0, net: 0, issued: 0 },
  )

  return (
    <div className="space-y-6">
      <StatementGenerator defaultPeriod={previousPeriod()} />

      <div className="glass rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link href="/admin/vip/partners/statements" className={!filter ? 'rounded-lg bg-white/15 px-2.5 py-1' : 'rounded-lg bg-white/5 px-2.5 py-1 text-white/60 hover:text-white'}>All</Link>
            {periods.map((p) => (
              <Link
                key={p.period}
                href={`/admin/vip/partners/statements?period=${p.period}`}
                className={filter === p.period ? 'rounded-lg bg-white/15 px-2.5 py-1' : 'rounded-lg bg-white/5 px-2.5 py-1 text-white/60 hover:text-white'}
              >
                {p.period}
              </Link>
            ))}
          </div>
          <a href={`${API}${filter ? `?period=${filter}` : ''}`} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15">
            Export CSV{filter ? ` (${filter})` : ''}
          </a>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-white/40">No statements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_td:first-child]:whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/40">
                  <th className="py-2">Month</th>
                  <th>Partner</th>
                  <th>Turnover</th>
                  <th>Fee</th>
                  <th>Points issued</th>
                  <th>Points redeemed</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((s) => (
                  <tr key={s.id} className="align-top">
                    <td className="py-2">{s.period}</td>
                    <td>{s.partner.name}</td>
                    <td>{formatPrice(s.turnoverCents)} <span className="block text-xs text-white/40">{s.earnCount} purchases</span></td>
                    <td>{formatPrice(s.feeCents)} <span className="block text-xs text-white/40">{(s.feeBps / 100).toFixed(2)}%</span></td>
                    <td>{s.pointsIssued.toLocaleString('en-US')} <span className="block text-xs text-white/40">{formatPrice(s.pointsIssuedCents)} liability</span></td>
                    <td>{s.pointsRedeemed.toLocaleString('en-US')} <span className="block text-xs text-white/40">{formatPrice(s.pointsRedeemedCents)} owed to partner</span></td>
                    <td className="font-semibold">
                      {s.netCents === 0 ? 'Nothing due' : s.netCents > 0 ? `Partner pays ${formatPrice(s.netCents)}` : `We pay ${formatPrice(-s.netCents)}`}
                    </td>
                    <td>
                      {s.status.toLowerCase()}
                      {s.issuedAt && <span className="block text-xs text-white/40">issued {formatDate(s.issuedAt)}</span>}
                      {s.settledAt && <span className="block text-xs text-white/40">settled {formatDate(s.settledAt)} · {s.settlementRef}</span>}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {s.status === 'DRAFT' && s.period < currentPeriod() && (
                          <AdminActionButton endpoint={API} tone="primary" label="Issue" confirmText="Issue this statement? Its figures are frozen from then on." body={{ op: 'issue', id: s.id }} />
                        )}
                        {s.status === 'ISSUED' && (
                          <AdminActionButton endpoint={API} tone="primary" label="Mark settled" body={{ op: 'settle', id: s.id }} prompt={{ field: 'settlementRef', question: 'Zelle reference / confirmation number' }} />
                        )}
                        <a href={`${API}?id=${s.id}`} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">CSV</a>
                        <a href={`${API}?lines=${s.id}`} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">Lines</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 text-xs text-white/60">
                  <td className="py-2" colSpan={3}>Totals (shown rows)</td>
                  <td>{formatPrice(totals.fee)}</td>
                  <td>{formatPrice(totals.issued)}</td>
                  <td>{formatPrice(totals.redeemed)}</td>
                  <td className="font-semibold text-white">{totals.net >= 0 ? `Net in ${formatPrice(totals.net)}` : `Net out ${formatPrice(-totals.net)}`}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-white/40">
          Net = network fee − value of points members spent at the partner. Points issued are the network’s liability and are shown, not billed. Settlement is by Zelle outside the app — record the reference when it clears.
        </p>
      </div>
    </div>
  )
}
