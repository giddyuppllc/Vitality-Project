import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Package } from 'lucide-react'

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'danger',
}

const ORDER_STATUSES = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
const PAGE_SIZE = 10

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const params = await searchParams
  const statusFilter = params.status && params.status !== 'ALL' ? params.status : undefined
  const searchQuery = params.q ?? ''
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10))

  const where: Record<string, unknown> = { userId: session.user.id }
  if (statusFilter) {
    where.status = statusFilter
  }
  if (searchQuery) {
    where.orderNumber = { contains: searchQuery, mode: 'insensitive' }
  }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where: where as any }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams()
    if (params.status) p.set('status', params.status)
    if (params.q) p.set('q', params.q)
    if (params.page) p.set('page', params.page)
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    const qs = p.toString()
    return `/account/orders${qs ? `?${qs}` : ''}`
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Order History</h1>

      {/* Filters */}
      <div className="glass rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <form action="/account/orders" method="GET" className="flex-1">
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Search by order number..."
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
            />
          </form>

          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUSES.map((s) => {
              const isActive =
                s === 'ALL' ? !statusFilter : statusFilter === s
              return (
                <Link
                  key={s}
                  href={buildUrl({ status: s === 'ALL' ? '' : s, page: '' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-500/20 text-brand-400'
                      : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {s}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Results info */}
      <p className="text-sm text-white/40 mb-4">
        {totalCount} order{totalCount !== 1 ? 's' : ''} found
        {searchQuery ? ` for "${searchQuery}"` : ''}
        {statusFilter ? ` with status ${statusFilter}` : ''}
      </p>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No orders found</h2>
          <p className="text-white/40 mb-6">
            {searchQuery || statusFilter
              ? 'Try adjusting your search or filters.'
              : 'When you place an order, it will appear here.'}
          </p>
          <Link href="/products" className="text-brand-400 hover:underline text-sm">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.id}`}>
              <div className="glass rounded-2xl p-5 card-hover cursor-pointer">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono font-bold text-brand-400">
                        {order.orderNumber}
                      </span>
                      <Badge variant={statusVariant[order.status] ?? 'default'}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/40">
                      {formatDate(order.createdAt)} &middot; {order.items.length} item
                      {order.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatPrice(order.total)}</p>
                    <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>
                      {order.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {currentPage > 1 && (
            <Link
              href={buildUrl({ page: String(currentPage - 1) })}
              className="px-4 py-2 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-sm transition-all"
            >
              Previous
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildUrl({ page: String(p) })}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                p === currentPage
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              {p}
            </Link>
          ))}
          {currentPage < totalPages && (
            <Link
              href={buildUrl({ page: String(currentPage + 1) })}
              className="px-4 py-2 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-sm transition-all"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
