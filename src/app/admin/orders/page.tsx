import Link from 'next/link'
import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Eye, Download } from 'lucide-react'
import { MarkPaidButton } from '@/components/admin/mark-paid-button'

const PAGE_SIZE = 50
const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED']

type Props = {
  searchParams: Promise<{ q?: string; status?: string; payment?: string; page?: string }>
}

// The list used to be the newest 100 orders with no search, filter or paging
// - anything older was unreachable from here and "N total" was really "100".
export default async function AdminOrdersPage({ searchParams }: Props) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const status = ORDER_STATUSES.find((s) => s === sp.status)
  const payment = PAYMENT_STATUSES.find((s) => s === sp.payment)
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(payment ? { paymentStatus: payment } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        items: { take: 1 },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageHref = (n: number) => {
    const usp = new URLSearchParams()
    if (q) usp.set('q', q)
    if (status) usp.set('status', status)
    if (payment) usp.set('payment', payment)
    if (n > 1) usp.set('page', String(n))
    const qs = usp.toString()
    return `/admin/orders${qs ? `?${qs}` : ''}`
  }
  const filtered = Boolean(q || status || payment)

  const statusVariant = (s: string) =>
    s === 'DELIVERED' ? 'success' :
    s === 'SHIPPED' ? 'info' :
    s === 'CANCELLED' ? 'danger' :
    s === 'PROCESSING' ? 'info' : 'warning'

  const paymentVariant = (s: string) =>
    s === 'PAID' ? 'success' : s === 'FAILED' ? 'danger' : 'warning'

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-white/40 mt-1">
            {total} {filtered ? 'matching' : 'total'}
            {totalPages > 1 && ` · page ${Math.min(page, totalPages)} of ${totalPages}`}
          </p>
        </div>
        <a
          href="/api/admin/orders/export"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      <form method="get" action="/admin/orders" className="glass rounded-xl flex flex-wrap items-center gap-2 px-4 py-3 mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Order #, email or customer name"
          aria-label="Search orders"
          className="flex-1 min-w-[12rem] bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
        />
        <select
          name="status"
          defaultValue={status ?? ''}
          aria-label="Filter by order status"
          className="bg-dark-700 border border-white/10 rounded-lg text-sm px-2 py-1.5"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          name="payment"
          defaultValue={payment ?? ''}
          aria-label="Filter by payment status"
          className="bg-dark-700 border border-white/10 rounded-lg text-sm px-2 py-1.5"
        >
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <button type="submit" className="text-xs uppercase tracking-wider text-brand-300 hover:text-brand-200 px-2 py-1">
          Search
        </button>
        {filtered && (
          <Link href="/admin/orders" className="text-xs text-white/40 hover:text-white px-2 py-1">
            Clear
          </Link>
        )}
      </form>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Order</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Customer</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Total</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Payment</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Date</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4">
                  <p className="text-sm font-mono font-medium">{order.orderNumber}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-medium">{order.user?.name ?? 'Guest'}</p>
                  <p className="text-xs text-white/40">{order.email}</p>
                </td>
                <td className="px-5 py-4 text-sm font-bold">{formatPrice(order.total)}</td>
                <td className="px-5 py-4">
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={paymentVariant(order.paymentStatus)}>{order.paymentStatus}</Badge>
                    {order.paymentMethod === 'zelle' && (
                      <span className="text-[10px] uppercase tracking-wider text-white/40">via Zelle</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-white/40">{formatDate(order.createdAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {order.paymentMethod === 'zelle' && order.paymentStatus === 'UNPAID' && (
                      <MarkPaidButton orderId={order.id} />
                    )}
                    <Link href={`/admin/orders/${order.id}`} className="p-1.5 text-white/30 hover:text-white transition-colors">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-white/40">
            {filtered ? 'No orders match these filters.' : 'No orders yet.'}
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5">
              ← Newer
            </Link>
          ) : <span />}
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5">
              Older →
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  )
}
