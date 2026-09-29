export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { DollarSign } from 'lucide-react'

export default async function BusinessCommissionsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!membership) redirect('/business/apply')

  const locations = await prisma.location.findMany({
    where: { organizationId: membership.organizationId },
    select: { id: true, name: true },
  })

  const locationIds = locations.map((l) => l.id)

  const commissions = await prisma.orderCommission.findMany({
    where: { locationId: { in: locationIds } },
    include: {
      order: { select: { orderNumber: true, total: true, createdAt: true } },
      location: { select: { name: true } },
    },
    orderBy: { order: { createdAt: 'desc' } },
    take: 100,
  })

  const totals = commissions.reduce(
    (acc, c) => {
      acc.total += c.amount
      if (c.status === 'PENDING') acc.pending += c.amount
      if (c.status === 'APPROVED') acc.approved += c.amount
      if (c.status === 'PAID') acc.paid += c.amount
      return acc
    },
    { total: 0, pending: 0, approved: 0, paid: 0 }
  )

  const statusVariant = (s: string) =>
    s === 'PAID' ? 'success' : s === 'APPROVED' ? 'info' : s === 'CANCELLED' ? 'danger' : 'warning'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Commissions</h1>
        <p className="text-white/40 mt-1">Track your earnings from location sales</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Total Earned</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold">{formatPrice(totals.total)}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Pending</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold">{formatPrice(totals.pending)}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Paid Out</span>
            <DollarSign className="w-5 h-5 text-brand-400" />
          </div>
          <div className="text-2xl font-bold">{formatPrice(totals.paid)}</div>
        </div>
      </div>

      {/* Commission History */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="font-semibold">Commission History</h2>
        </div>
        {commissions.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-sm">
            No commissions yet. Commissions are earned when customers purchase through your location kiosks.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Order</th>
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Location</th>
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Order Total</th>
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Commission</th>
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {commissions.map((c) => (
                <tr key={c.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4 text-sm font-mono">{c.order.orderNumber}</td>
                  <td className="px-5 py-4 text-sm text-white/60">{c.location.name}</td>
                  <td className="px-5 py-4 text-sm">{formatPrice(c.order.total)}</td>
                  <td className="px-5 py-4 text-sm font-bold text-emerald-400">{formatPrice(c.amount)}</td>
                  <td className="px-5 py-4">
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/40">{formatDate(c.order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
