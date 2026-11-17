import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { findUserIdByMemberNumber, formatMemberNumber } from '@/lib/vip/member-card'
import { PointsAdjustForm } from '@/components/admin/vip/rewards-forms'

export const dynamic = 'force-dynamic'

async function resolve(q: string) {
  const s = q.trim()
  if (!s) return null
  if (s.includes('@')) {
    return (await prisma.user.findFirst({ where: { email: { equals: s, mode: 'insensitive' } }, select: { id: true } }))?.id ?? null
  }
  return findUserIdByMemberNumber(s)
}

export default async function AdminPointsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage()
  const { q = '' } = await searchParams
  const [totals, userId] = await Promise.all([
    prisma.loyaltyAccount.aggregate({ _sum: { points: true }, _count: { _all: true }, where: { points: { gt: 0 } } }),
    resolve(q),
  ])
  const outstanding = totals._sum.points ?? 0
  const member = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          name: true,
          loyalty: { select: { points: true, lifetimeSpend: true, transactions: { orderBy: { createdAt: 'desc' }, take: 50 } } },
        },
      })
    : null
  const card = userId ? await prisma.vipMemberCard.findUnique({ where: { userId } }) : null

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <div className="space-y-4">
        <div className="glass rounded-2xl p-5 text-sm">
          <h2 className="font-semibold">Points liability</h2>
          <p className="mt-1 text-white/70">
            <span className="text-2xl font-bold text-white">{outstanding.toLocaleString('en-US')}</span> points outstanding across {totals._count._all} accounts ={' '}
            <span className="font-semibold text-white">{formatPrice(outstanding)}</span> at 100 points = $1.
          </p>
        </div>
        <form className="glass flex flex-wrap items-end gap-2 rounded-2xl p-5" method="get">
          <label className="block min-w-[16rem] flex-1 text-sm text-white/60">
            Look up a member (email or member number)
            <input name="q" defaultValue={q} className="mt-1 w-full rounded-xl border border-white/10 bg-dark-700 px-3 py-2 text-sm text-white" />
          </label>
          <button type="submit" className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Look up</button>
        </form>
        {q && !member && <p className="glass rounded-2xl p-5 text-sm text-white/50">No member found for “{q}”.</p>}
        {member && (
          <div className="glass rounded-2xl p-5 text-sm">
            <p className="font-medium">{member.email}{member.name ? ` · ${member.name}` : ''}</p>
            <p className="text-xs text-white/40">
              {card ? `Member number ${formatMemberNumber(card.memberNumber)} · ` : ''}
              Balance {(member.loyalty?.points ?? 0).toLocaleString('en-US')} pts · lifetime store spend {formatPrice(member.loyalty?.lifetimeSpend ?? 0)}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wider text-white/40">
                    <th className="py-2">When</th><th>Type</th><th>Source</th><th>Description</th><th className="text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(member.loyalty?.transactions ?? []).map((t) => (
                    <tr key={t.id}>
                      <td className="py-1.5 text-white/50">{formatDate(t.createdAt)}</td>
                      <td>{t.type}</td>
                      <td className="text-white/50">{t.source ?? ''}</td>
                      <td className="max-w-xs truncate text-white/70">{t.description}</td>
                      <td className={t.points >= 0 ? 'text-right text-emerald-300' : 'text-right text-white/70'}>{t.points.toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <PointsAdjustForm key={member?.email ?? 'none'} defaultMember={member?.email ?? ''} />
    </div>
  )
}
