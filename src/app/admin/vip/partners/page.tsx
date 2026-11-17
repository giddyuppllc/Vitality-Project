import Link from 'next/link'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { periodFor } from '@/lib/vip/rewards'
import { periodRange } from '@/lib/vip/statements'
import { PartnerForm } from '@/components/admin/vip/rewards-forms'

export const dynamic = 'force-dynamic'

export default async function AdminPartnersPage() {
  await requireAdminPage()
  const period = periodFor(new Date())
  const { start, end } = periodRange(period)
  const [partners, monthly] = await Promise.all([
    prisma.vipPartner.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { staff: { where: { active: true } } } } } }),
    prisma.vipPartnerTxn.groupBy({
      by: ['partnerId', 'kind'],
      where: { createdAt: { gte: start, lt: end }, voidedAt: null },
      _sum: { amountCents: true, points: true },
      _count: { _all: true },
    }),
  ])
  const sum = (pid: string, kind: 'EARN' | 'REDEEM') => monthly.find((m) => m.partnerId === pid && m.kind === kind)
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_30rem]">
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Earn</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Spend points</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">This month</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {partners.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/30">No partners yet — add Kevin’s first business on the right.</td>
              </tr>
            )}
            {partners.map((p) => {
              const e = sum(p.id, 'EARN')
              const r = sum(p.id, 'REDEEM')
              return (
                <tr key={p.id} className={p.active ? '' : 'opacity-60'}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/vip/partners/${p.id}`} className="font-medium text-brand-300 hover:text-brand-200">{p.name}</Link>
                    <span className="block text-xs text-white/40">{p.slug}{p.active ? '' : ' · inactive'}</span>
                  </td>
                  <td className="px-4 py-3">{p.earnPointsPerDollar} pts/$</td>
                  <td className="px-4 py-3">{(p.networkFeeBps / 100).toFixed(2)}%</td>
                  <td className="px-4 py-3">{p.allowRedemption ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{p._count.staff}</td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    {formatPrice(e?._sum.amountCents ?? 0)} turnover · {(e?._sum.points ?? 0).toLocaleString('en-US')} pts issued · {(r?._sum.points ?? 0).toLocaleString('en-US')} pts spent
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PartnerForm />
    </div>
  )
}
