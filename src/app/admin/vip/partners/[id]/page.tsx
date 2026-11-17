import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { formatMemberNumber } from '@/lib/vip/member-card'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'
import { PartnerForm, StaffAddForm } from '@/components/admin/vip/rewards-forms'

export const dynamic = 'force-dynamic'

const API = '/api/admin/vip/partners'

export default async function AdminPartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const partner = await prisma.vipPartner.findUnique({
    where: { id },
    include: {
      staff: { orderBy: { createdAt: 'asc' } },
      txns: { orderBy: { createdAt: 'desc' }, take: 50 },
      statements: { orderBy: { period: 'desc' }, take: 12 },
    },
  })
  if (!partner) notFound()
  const userIds = [...new Set([...partner.staff.map((s) => s.userId), ...partner.txns.map((t) => t.staffUserId)])]
  const memberIds = [...new Set(partner.txns.map((t) => t.memberUserId))]
  const [users, cards] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } }),
    prisma.vipMemberCard.findMany({ where: { userId: { in: memberIds } } }),
  ])
  const u = new Map(users.map((x) => [x.id, x]))
  const num = new Map(cards.map((c) => [c.userId, formatMemberNumber(c.memberNumber)]))

  return (
    <div className="space-y-6">
      <Link href="/admin/vip/partners" className="text-sm text-white/50 hover:text-white">← All partners</Link>
      <div className="grid gap-6 xl:grid-cols-2">
        <PartnerForm partner={partner} />
        <div className="glass space-y-4 rounded-2xl p-5">
          <h2 className="font-semibold">Staff</h2>
          <p className="text-xs text-white/40">
            Staff sign in at vitalityproject.vip/partners/portal with their own account. They can act only for this business.
          </p>
          {partner.staff.length === 0 ? (
            <p className="text-sm text-white/40">No staff linked yet.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {partner.staff.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className={s.active ? '' : 'opacity-50'}>
                    {u.get(s.userId)?.email ?? s.userId} <span className="text-xs text-white/40">· {s.role.toLowerCase()}{s.active ? '' : ' · disabled'}</span>
                  </span>
                  <span className="flex gap-1.5">
                    <AdminActionButton endpoint={API} label={s.active ? 'Disable' : 'Enable'} body={{ op: 'staff.update', id: s.id, active: !s.active, role: s.role }} />
                    <AdminActionButton endpoint={API} tone="danger" label="Remove" confirmText="Remove this person from the partner?" body={{ op: 'staff.remove', id: s.id }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <StaffAddForm partnerId={partner.id} />
        </div>
      </div>

      <div className="glass overflow-x-auto rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Statements</h2>
          <Link href="/admin/vip/partners/statements" className="text-sm text-brand-300 hover:text-brand-200">All statements →</Link>
        </div>
        {partner.statements.length === 0 ? (
          <p className="text-sm text-white/40">None yet — generated on the 1st for the month just ended.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-white/40">
                <th className="py-2">Month</th><th>Status</th><th>Turnover</th><th>Fee</th><th>Redeemed</th><th>Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {partner.statements.map((s) => (
                <tr key={s.id}>
                  <td className="py-2">{s.period}</td>
                  <td>{s.status.toLowerCase()}</td>
                  <td>{formatPrice(s.turnoverCents)}</td>
                  <td>{formatPrice(s.feeCents)}</td>
                  <td>{formatPrice(s.pointsRedeemedCents)}</td>
                  <td className="font-semibold">{s.netCents >= 0 ? `${formatPrice(s.netCents)} due from partner` : `${formatPrice(-s.netCents)} due to partner`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass overflow-x-auto rounded-2xl p-5">
        <h2 className="mb-3 font-semibold">Recent transactions</h2>
        {partner.txns.length === 0 ? (
          <p className="text-sm text-white/40">No transactions yet.</p>
        ) : (
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wider text-white/40">
                <th className="py-2">When</th><th>Type</th><th>Member</th><th>Receipt</th><th>Amount</th><th>Points</th><th>Staff</th><th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {partner.txns.map((t) => (
                <tr key={t.id} className={t.voidedAt ? 'opacity-50' : ''}>
                  <td className="py-1.5">{formatDate(t.createdAt)}</td>
                  <td>{t.kind === 'EARN' ? 'Purchase' : 'Points spent'}</td>
                  <td className="font-mono">{num.get(t.memberUserId) ?? ''}</td>
                  <td>{t.receiptRef ?? ''}</td>
                  <td>{formatPrice(t.amountCents)}</td>
                  <td>{t.points.toLocaleString('en-US')}</td>
                  <td className="text-white/50">{u.get(t.staffUserId)?.email ?? ''}</td>
                  <td>{t.voidedAt ? `voided${t.voidReason ? ` (${t.voidReason})` : ''}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
