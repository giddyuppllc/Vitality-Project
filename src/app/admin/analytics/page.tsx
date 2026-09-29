import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import {
  TrendingUp,
  ShoppingBag,
  Users,
  DollarSign,
  Package,
  Eye,
  Globe,
  BarChart3,
} from 'lucide-react'

async function getAnalytics() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    revenueTotal,
    revenue30d,
    revenue7d,
    orders30d,
    orders7d,
    newCustomers30d,
    topProducts,
    ordersByStatus,
    paymentMethods,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: thirtyDaysAgo } }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: sevenDaysAgo } }, _sum: { total: true }, _count: true }),
    prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
    prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.order.groupBy({ by: ['paymentMethod'], _count: { id: true } }),
  ])

  // Page view analytics — last 30d
  const [topPages, pageViews30d, sessionsByDayRows, referrerRows] = await Promise.all([
    prisma.pageView.groupBy({
      by: ['path'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.$queryRawUnsafe<{ day: Date; sessions: bigint }[]>(
      `SELECT DATE_TRUNC('day', "createdAt") AS day,
              COUNT(DISTINCT "sessionId")::bigint AS sessions
         FROM page_views
        WHERE "createdAt" >= $1
        GROUP BY 1
        ORDER BY 1 ASC`,
      thirtyDaysAgo
    ),
    prisma.$queryRawUnsafe<{ source: string; count: bigint }[]>(
      `SELECT COALESCE(NULLIF(SPLIT_PART(SPLIT_PART(referrer, '://', 2), '/', 1), ''), 'direct') AS source,
              COUNT(*)::bigint AS count
         FROM page_views
        WHERE "createdAt" >= $1
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 10`,
      thirtyDaysAgo
    ),
  ])

  // Conversion funnel (last 30d, based on page views + orders)
  const [landingSessions, productSessions, cartSessions, checkoutSessions] =
    await Promise.all([
      prisma.pageView
        .findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        })
        .then((r) => r.length),
      prisma.pageView
        .findMany({
          where: { createdAt: { gte: thirtyDaysAgo }, path: { startsWith: '/products' } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        })
        .then((r) => r.length),
      prisma.pageView
        .findMany({
          where: { createdAt: { gte: thirtyDaysAgo }, path: { startsWith: '/cart' } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        })
        .then((r) => r.length),
      prisma.pageView
        .findMany({
          where: { createdAt: { gte: thirtyDaysAgo }, path: { startsWith: '/checkout' } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        })
        .then((r) => r.length),
    ])
  const completedOrders = await prisma.order.count({
    where: { paymentStatus: 'PAID', createdAt: { gte: thirtyDaysAgo } },
  })

  // Normalize sessions-by-day — fill missing days with 0
  const sessionsByDay: { day: string; sessions: number }[] = []
  const dayMap = new Map<string, number>()
  for (const row of sessionsByDayRows) {
    const key = new Date(row.day).toISOString().slice(0, 10)
    dayMap.set(key, Number(row.sessions))
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    sessionsByDay.push({ day: key.slice(5), sessions: dayMap.get(key) ?? 0 })
  }

  return {
    revenueTotal: revenueTotal._sum.total ?? 0,
    revenue30d: revenue30d._sum.total ?? 0,
    revenue7d: revenue7d._sum.total ?? 0,
    ordersTotal30d: orders30d,
    ordersTotal7d: orders7d,
    paidOrders30d: revenue30d._count,
    paidOrders7d: revenue7d._count,
    newCustomers30d,
    topProducts,
    ordersByStatus,
    paymentMethods,
    topPages,
    pageViews30d,
    sessionsByDay,
    referrers: referrerRows.map((r) => ({ source: r.source, count: Number(r.count) })),
    funnel: {
      landing: landingSessions,
      product: productSessions,
      cart: cartSessions,
      checkout: checkoutSessions,
      complete: completedOrders,
    },
  }
}

export default async function AdminAnalyticsPage() {
  const data = await getAnalytics()

  const maxSessions = Math.max(1, ...data.sessionsByDay.map((d) => d.sessions))
  const funnelSteps = [
    { label: 'Landing', value: data.funnel.landing },
    { label: 'Product', value: data.funnel.product },
    { label: 'Cart', value: data.funnel.cart },
    { label: 'Checkout', value: data.funnel.checkout },
    { label: 'Complete', value: data.funnel.complete },
  ]
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.value))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-white/40 mt-1">Revenue, traffic, and conversion overview</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'All-Time Revenue', value: formatPrice(data.revenueTotal), icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Revenue (30d)', value: formatPrice(data.revenue30d), icon: TrendingUp, color: 'text-brand-400' },
          { label: 'Orders (30d)', value: data.ordersTotal30d.toString(), icon: ShoppingBag, color: 'text-purple-400' },
          { label: 'New Customers (30d)', value: data.newCustomers30d.toString(), icon: Users, color: 'text-amber-400' },
          { label: 'Page Views (30d)', value: data.pageViews30d.toLocaleString(), icon: Eye, color: 'text-cyan-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Sessions chart (30d) */}
      <div className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-400" /> Sessions — last 30 days
        </h2>
        <div className="flex items-end gap-1 h-40">
          {data.sessionsByDay.map((d) => (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center gap-1 group"
              title={`${d.day}: ${d.sessions} sessions`}
            >
              <div
                className="w-full bg-brand-500/70 hover:bg-brand-400 rounded-t transition-colors"
                style={{ height: `${(d.sessions / maxSessions) * 100}%`, minHeight: '2px' }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-white/30 mt-2">
          <span>{data.sessionsByDay[0]?.day}</span>
          <span>{data.sessionsByDay[data.sessionsByDay.length - 1]?.day}</span>
        </div>
      </div>

      {/* Funnel */}
      <div className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-400" /> Conversion Funnel (30d)
        </h2>
        <div className="space-y-3">
          {funnelSteps.map((step, i) => {
            const prev = i === 0 ? step.value : funnelSteps[i - 1].value
            const pct = prev > 0 ? Math.round((step.value / prev) * 100) : 0
            return (
              <div key={step.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/70">{step.label}</span>
                  <span className="text-white font-medium">
                    {step.value.toLocaleString()}
                    {i > 0 && (
                      <span className="text-white/40 ml-2 text-xs">({pct}%)</span>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-brand-400"
                    style={{ width: `${(step.value / funnelMax) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Pages */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-brand-400" /> Top Pages (30d)
          </h2>
          <div className="space-y-2.5">
            {data.topPages.length === 0 && (
              <p className="text-white/30 text-sm">No traffic recorded yet</p>
            )}
            {data.topPages.map((p, i) => (
              <div key={p.path} className="flex items-center gap-3">
                <span className="text-white/30 text-xs w-4">{i + 1}</span>
                <span className="flex-1 text-sm text-white/70 truncate">{p.path}</span>
                <span className="text-sm font-bold">{p._count.id.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Traffic sources */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-400" /> Traffic Sources (30d)
          </h2>
          <div className="space-y-2.5">
            {data.referrers.length === 0 && (
              <p className="text-white/30 text-sm">No referrer data yet</p>
            )}
            {data.referrers.map((r, i) => (
              <div key={`${r.source}-${i}`} className="flex items-center gap-3">
                <span className="text-white/30 text-xs w-4">{i + 1}</span>
                <span className="flex-1 text-sm text-white/70 truncate">{r.source}</span>
                <span className="text-sm font-bold">{r.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-400" /> Top Products
          </h2>
          <div className="space-y-3">
            {data.topProducts.length === 0 && <p className="text-white/30 text-sm">No sales yet</p>}
            {data.topProducts.map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3">
                <span className="text-white/30 text-xs w-4">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-white/40">{p._sum.quantity} units sold</p>
                </div>
                <span className="text-sm font-bold text-emerald-400">{formatPrice(p._sum.total ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orders by status */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-brand-400" /> Orders by Status
          </h2>
          <div className="space-y-3">
            {data.ordersByStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <span className="text-sm text-white/60">{s.status}</span>
                <span className="text-sm font-bold">{s._count.id}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-white/5 pt-4">
            <h3 className="text-sm text-white/50 mb-3">Payment Methods Used</h3>
            {data.paymentMethods.map((m) => (
              <div key={m.paymentMethod ?? 'none'} className="flex items-center justify-between py-1">
                <span className="text-sm text-white/60 uppercase">{m.paymentMethod ?? 'Unknown'}</span>
                <span className="text-sm font-medium">{m._count.id} orders</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
