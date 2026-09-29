import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Eye, Download } from 'lucide-react'
import { MarkPaidButton } from '@/components/admin/mark-paid-button'

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    include: {
      items: { take: 1 },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

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
          <p className="text-white/40 mt-1">{orders.length} total</p>
        </div>
        <a
          href="/api/admin/orders/export"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

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
      </div>
    </div>
  )
}
