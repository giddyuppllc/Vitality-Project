import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import {
  ShoppingBag,
  Users,
  DollarSign,
  Package,
  AlertCircle,
  CheckSquare,
  TrendingUp,
  Receipt,
  Percent,
  RefreshCcw,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { InstallAppButton } from '@/components/admin/install-app-button'
import { PendingActionsBanner } from '@/components/admin/pending-actions-banner'

async function getDashboardStats(adminUserId: string | null) {
  // Month-to-date window for the P&L card.
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalOrders,
    totalRevenue,
    totalCustomers,
    totalProducts,
    recentOrders,
    lowStockProducts,
    myTasks,
    monthOrders,
    monthRefundsRow,
    monthLegacyRefunds,
    topProductsRows,
    topCustomersRows,
  ] = await Promise.all([
    prisma.order.count({ where: { paymentStatus: 'PAID' } }),
    prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { items: { take: 1 } },
    }),
    prisma.product.findMany({
      where: { inventory: { lte: 5 }, status: 'ACTIVE' },
      take: 5,
      orderBy: { inventory: 'asc' },
    }),
    adminUserId
      ? prisma.adminTask.findMany({
          where: {
            assignedTo: adminUserId,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
          take: 6,
        })
      : Promise.resolve([]),
    // Month-to-date paid orders, with item product cost for COGS rollup.
    prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: monthStart },
      },
      select: {
        total: true,
        subtotal: true,
        discount: true,
        items: {
          select: {
            quantity: true,
            product: { select: { cost: true } },
          },
        },
      },
    }),
    // Refund cost MTD. Two sources:
    //   1. The first-class Refund model (cash + store-credit + manual)
    //   2. Legacy StoreCreditTxn type=REFUND for any pre-Refund-model rows.
    // We query both and add — Refund rows are authoritative going forward,
    // StoreCreditTxn is the historical fallback.
    prisma.refund.aggregate({
      where: { createdAt: { gte: monthStart }, status: { not: 'FAILED' } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: 0 } as { amount: number | null } })),
    prisma.storeCreditTxn.aggregate({
      where: { type: 'REFUND', createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: 0 } as { amount: number | null } })),
    // Top 5 products MTD by gross revenue.
    prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      where: { order: { paymentStatus: 'PAID', createdAt: { gte: monthStart } } },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
    // Top 5 customers MTD by gross revenue.
    prisma.order.groupBy({
      by: ['email'],
      where: { paymentStatus: 'PAID', createdAt: { gte: monthStart } },
      _sum: { total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
  ])

  // ── P&L MTD rollup ──────────────────────────────────────────────────────
  let mtdRevenue = 0
  let mtdCogs = 0
  let mtdDiscount = 0
  for (const o of monthOrders) {
    mtdRevenue += o.total
    mtdDiscount += o.discount
    for (const it of o.items) {
      const unitCost = it.product?.cost ?? 0
      mtdCogs += unitCost * it.quantity
    }
  }
  // Sum both refund sources (Refund model + legacy StoreCreditTxn) — both
  // store positive cent values; treat as a cost line in P&L.
  const mtdRefunds =
    Math.abs(monthRefundsRow._sum.amount ?? 0) +
    Math.abs(monthLegacyRefunds._sum.amount ?? 0)
  const mtdGrossProfit = mtdRevenue - mtdCogs - mtdRefunds
  const mtdMargin = mtdRevenue > 0 ? (mtdGrossProfit / mtdRevenue) * 100 : 0
  const mtdAov = monthOrders.length > 0 ? Math.round(mtdRevenue / monthOrders.length) : 0
  // Items where Product.cost wasn't populated — surface as a data-quality flag
  // so Edward knows margin is understated (treats unknown cost as zero).
  const mtdItemsWithoutCost = monthOrders.reduce(
    (n, o) => n + o.items.filter((it) => it.product?.cost == null).length,
    0,
  )
  const mtdItemsTotal = monthOrders.reduce((n, o) => n + o.items.length, 0)

  const topProducts = topProductsRows.map((r) => ({
    productId: r.productId,
    name: r.name,
    revenue: r._sum.total ?? 0,
    units: r._sum.quantity ?? 0,
  }))
  const topCustomers = topCustomersRows.map((r) => ({
    email: r.email,
    revenue: r._sum.total ?? 0,
    orders: r._count._all,
  }))

  return {
    totalOrders,
    totalRevenue: totalRevenue._sum.total ?? 0,
    totalCustomers,
    totalProducts,
    recentOrders,
    lowStockProducts,
    myTasks,
    topProducts,
    topCustomers,
    pnl: {
      revenue: mtdRevenue,
      cogs: mtdCogs,
      grossProfit: mtdGrossProfit,
      margin: mtdMargin,
      aov: mtdAov,
      orders: monthOrders.length,
      discount: mtdDiscount,
      refunds: mtdRefunds,
      itemsWithoutCost: mtdItemsWithoutCost,
      itemsTotal: mtdItemsTotal,
    },
  }
}

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  const stats = await getDashboardStats(session?.user?.id ?? null)

  const statCards = [
    { label: 'Total Revenue', value: formatPrice(stats.totalRevenue), icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Total Orders', value: stats.totalOrders.toString(), icon: ShoppingBag, color: 'text-brand-400' },
    { label: 'Customers', value: stats.totalCustomers.toString(), icon: Users, color: 'text-purple-400' },
    { label: 'Active Products', value: stats.totalProducts.toString(), icon: Package, color: 'text-amber-400' },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-white/40 mt-1">Overview of The Vitality Project</p>
        </div>
        <div className="w-full sm:w-80 sm:shrink-0">
          <InstallAppButton />
        </div>
      </div>

      {/* Action-required notices: missing payment config, queued campaigns */}
      <PendingActionsBanner />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/40">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      {/* P&L this month — plain English business-owner view */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Profit &amp; Loss — this month
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              {stats.pnl.orders} paid order{stats.pnl.orders === 1 ? '' : 's'}
              {' · '}month-to-date
            </p>
          </div>
          {stats.pnl.itemsWithoutCost > 0 && (
            <div className="text-right text-[11px] text-amber-400/80">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              {stats.pnl.itemsWithoutCost}/{stats.pnl.itemsTotal} items missing cost
              <div className="text-[10px] text-white/40">
                Margin understated until <Link href="/admin/products" className="text-amber-300 hover:text-amber-200 underline">cost is filled in</Link>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {/* Money in */}
          <div>
            <div className="text-xs text-white/40 mb-1 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" /> Money in
            </div>
            <div className="text-xl font-bold text-emerald-400">{formatPrice(stats.pnl.revenue)}</div>
            <div className="text-[10px] text-white/40 mt-0.5">customer payments</div>
          </div>
          {/* Cost of goods */}
          <div>
            <div className="text-xs text-white/40 mb-1 flex items-center gap-1.5">
              <Package className="w-3 h-3" /> Cost of goods
            </div>
            <div className="text-xl font-bold text-rose-400">−{formatPrice(stats.pnl.cogs)}</div>
            <div className="text-[10px] text-white/40 mt-0.5">what you paid suppliers</div>
          </div>
          {/* Refunds */}
          <div>
            <div className="text-xs text-white/40 mb-1 flex items-center gap-1.5">
              <RefreshCcw className="w-3 h-3" /> Refunds
            </div>
            <div className="text-xl font-bold text-rose-400">−{formatPrice(stats.pnl.refunds)}</div>
            <div className="text-[10px] text-white/40 mt-0.5">money back to customers</div>
          </div>
          {/* Profit */}
          <div className="border-l border-white/10 pl-4">
            <div className="text-xs text-white/40 mb-1 flex items-center gap-1.5">
              <Wallet className="w-3 h-3" /> What you keep
            </div>
            <div className={`text-xl font-bold ${stats.pnl.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPrice(stats.pnl.grossProfit)}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              {stats.pnl.margin.toFixed(1)}% margin
            </div>
          </div>
        </div>

        {/* Secondary row: discount + AOV */}
        <div className="flex items-center gap-6 text-xs text-white/50 pt-4 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <Receipt className="w-3 h-3 text-amber-400" />
            <span>Average order:</span>
            <span className="font-semibold text-white">{formatPrice(stats.pnl.aov)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Percent className="w-3 h-3 text-purple-400" />
            <span>Discount given:</span>
            <span className="font-semibold text-white">{formatPrice(stats.pnl.discount)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-brand-400" /> Recent Orders
          </h2>
          <div className="space-y-3">
            {stats.recentOrders.length === 0 && (
              <p className="text-white/30 text-sm">No orders yet</p>
            )}
            {stats.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium">{order.orderNumber}</p>
                  <p className="text-xs text-white/40">{order.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatPrice(order.total)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    order.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                    order.status === 'SHIPPED' ? 'bg-blue-500/20 text-blue-400' :
                    order.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{order.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" /> Low Stock Alert
          </h2>
          <div className="space-y-3">
            {stats.lowStockProducts.length === 0 && (
              <p className="text-white/30 text-sm">All products sufficiently stocked</p>
            )}
            {stats.lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <p className="text-sm font-medium">{product.name}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  product.inventory === 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {product.inventory === 0 ? 'Out of stock' : `${product.inventory} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" /> Top Products this month
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-white/30 text-sm">No paid orders yet this month.</p>
          ) : (
            <div className="space-y-2">
              {stats.topProducts.map((p, i) => (
                <Link
                  key={p.productId}
                  href={`/admin/products/${p.productId}`}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-white/40 w-4">{i + 1}.</span>
                    <p className="text-sm font-medium truncate">{p.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-400">{formatPrice(p.revenue)}</p>
                    <p className="text-[10px] text-white/40">{p.units} sold</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" /> Top Customers this month
          </h2>
          {stats.topCustomers.length === 0 ? (
            <p className="text-white/30 text-sm">No paid orders yet this month.</p>
          ) : (
            <div className="space-y-2">
              {stats.topCustomers.map((c, i) => (
                <div
                  key={c.email}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-white/40 w-4">{i + 1}.</span>
                    <p className="text-sm font-medium truncate">{c.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-400">{formatPrice(c.revenue)}</p>
                    <p className="text-[10px] text-white/40">{c.orders} order{c.orders === 1 ? '' : 's'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Your Open Tasks */}
      <div className="glass rounded-2xl p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-purple-400" /> Your Open Tasks
          </h2>
          <Link
            href="/admin/tasks"
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            View all →
          </Link>
        </div>
        {stats.myTasks.length === 0 ? (
          <p className="text-white/30 text-sm">
            Nothing on your plate right now.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {stats.myTasks.map((t) => (
              <div
                key={t.id}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-white/40">
                    {t.dueAt ? `Due ${formatDate(t.dueAt)}` : 'No due date'}
                  </p>
                </div>
                <Badge
                  variant={
                    t.priority === 'URGENT' || t.priority === 'HIGH'
                      ? 'danger'
                      : t.priority === 'LOW'
                        ? 'default'
                        : 'info'
                  }
                >
                  {t.priority}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
