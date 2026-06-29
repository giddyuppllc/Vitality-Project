import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Download } from 'lucide-react'
import type { CommissionStatus } from '@prisma/client'

interface PageProps {
  searchParams: Promise<{
    status?: string
    code?: string
    days?: string
  }>
}

// Admin commissions inspector. Filterable by status (PENDING / APPROVED /
// PAID / CANCELLED), affiliate code, and recency. Linked from the main
// affiliates list so admin can scan/approve/cancel without opening each
// affiliate detail page.
export default async function AdminCommissionsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  // Only accept a valid CommissionStatus — an invalid ?status= was 500ing the page.
  const COMMISSION_STATUSES = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED']
  const rawStatus = sp.status?.toUpperCase() ?? ''
  const status = (COMMISSION_STATUSES.includes(rawStatus) ? rawStatus : '') as CommissionStatus | ''
  const code = sp.code?.toUpperCase() ?? ''
  const days = Math.max(0, Math.min(365, parseInt(sp.days ?? '90') || 90))

  const since = new Date(Date.now() - days * 86400e3)

  const commissions = await prisma.affiliateCommission.findMany({
    where: {
      createdAt: { gte: since },
      ...(status ? { status } : {}),
      ...(code
        ? { affiliate: { code: { contains: code } } }
        : {}),
    },
    include: {
      affiliate: {
        select: {
          code: true,
          commissionRate: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  // Order details for each commission (one query for all)
  const orderIds = commissions.map((c) => c.orderId)
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      paymentStatus: true,
      createdAt: true,
    },
  })
  const orderById = Object.fromEntries(orders.map((o) => [o.id, o]))

  const totals = commissions.reduce(
    (acc, c) => {
      acc.count += 1
      acc.amount += c.amount
      acc.byStatus[c.status] = (acc.byStatus[c.status] ?? 0) + c.amount
      return acc
    },
    { count: 0, amount: 0, byStatus: {} as Record<string, number> },
  )

  const statuses: Array<{ key: '' | CommissionStatus; label: string }> = [
    { key: '', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'PAID', label: 'Paid' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="text-white/40 mt-1">
            {totals.count} rows · {formatPrice(totals.amount)} total · last {days} days
          </p>
        </div>
        <a
          href="/api/admin/affiliates/commissions/export"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {statuses.map((s) => {
          const params = new URLSearchParams()
          if (s.key) params.set('status', s.key)
          if (code) params.set('code', code)
          if (days !== 90) params.set('days', String(days))
          const active = (status || '') === s.key
          return (
            <a
              key={s.label}
              href={`/admin/affiliates/commissions${params.toString() ? '?' + params.toString() : ''}`}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                active
                  ? 'bg-brand-500/20 border-brand-500/40 text-white'
                  : 'bg-dark-700 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {s.label}
              {s.key && totals.byStatus[s.key] != null && (
                <span className="ml-1.5 text-xs text-white/40">{formatPrice(totals.byStatus[s.key])}</span>
              )}
            </a>
          )
        })}
      </div>

      {/* Filter form */}
      <form className="flex flex-wrap gap-2 mb-4" action="/admin/affiliates/commissions" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="code"
          defaultValue={code}
          placeholder="affiliate code"
          className="px-3 py-1.5 rounded-lg bg-dark-700 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-400"
        />
        <select
          name="days"
          defaultValue={String(days)}
          className="px-3 py-1.5 rounded-lg bg-dark-700 border border-white/10 text-sm text-white"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg bg-brand-500/20 border border-brand-500/40 text-sm text-white hover:bg-brand-500/30"
        >
          Filter
        </button>
        {(code || days !== 90 || status) && (
          <a
            href="/admin/affiliates/commissions"
            className="px-3 py-1.5 rounded-lg bg-dark-700 border border-white/10 text-sm text-white/60 hover:text-white"
          >
            Clear
          </a>
        )}
      </form>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Affiliate</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Order</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Order Total</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Commission</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {commissions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-white/40">
                  No commissions match the filters.
                </td>
              </tr>
            )}
            {commissions.map((c) => {
              const order = orderById[c.orderId]
              return (
                <tr key={c.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-3 text-sm text-white/50">{formatDate(c.createdAt)}</td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium">{c.affiliate.user.name}</p>
                    <p className="text-xs text-white/40">
                      <code className="text-brand-400">{c.affiliate.code}</code>
                      <span className="ml-2 text-white/30">{(c.affiliate.commissionRate * 100).toFixed(1)}%</span>
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    {order ? (
                      <a href={`/admin/orders/${order.id}`} className="text-sm text-brand-400 hover:text-brand-300">
                        {order.orderNumber}
                      </a>
                    ) : (
                      <span className="text-xs text-white/30">(missing)</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-white/50">
                    {order ? formatPrice(order.total) : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-emerald-400">
                    {formatPrice(c.amount)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={
                        c.status === 'APPROVED'
                          ? 'success'
                          : c.status === 'PENDING'
                            ? 'warning'
                            : c.status === 'PAID'
                              ? 'info'
                              : 'danger'
                      }
                    >
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
