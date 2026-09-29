import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  Settings,
  ShoppingBag,
  DollarSign,
  User,
  MapPin,
  Heart,
  Users,
  ArrowRight,
} from 'lucide-react'

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'danger',
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const [user, orders, addressCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { items: true },
    }),
    prisma.address.count({ where: { userId: session.user.id } }),
  ])

  if (!user) redirect('/auth/login')

  const allOrders = await prisma.order.findMany({
    where: { userId: session.user.id },
    select: { total: true },
  })

  const orderCount = allOrders.length
  const totalSpent = allOrders.reduce((sum, o) => sum + o.total, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
          <User className="w-7 h-7 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.name ?? 'My Account'}</h1>
          <p className="text-white/40 text-sm">Member since {formatDate(user.createdAt)}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-5 h-5 text-brand-400" />
            <span className="text-sm text-white/50">Orders</span>
          </div>
          <p className="text-2xl font-bold">{orderCount}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-brand-400" />
            <span className="text-sm text-white/50">Total Spent</span>
          </div>
          <p className="text-2xl font-bold">{formatPrice(totalSpent)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-5 h-5 text-brand-400" />
            <span className="text-sm text-white/50">Saved Addresses</span>
          </div>
          <p className="text-2xl font-bold">{addressCount}</p>
        </div>
      </div>

      {/* Recent Orders */}
      {orders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            <Link
              href="/account/orders"
              className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {orders.map((order) => (
              <Link key={order.id} href={`/account/orders/${order.id}`}>
                <div className="glass rounded-2xl p-4 card-hover cursor-pointer">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-bold text-brand-400 text-sm">
                          {order.orderNumber}
                        </span>
                        <Badge variant={statusVariant[order.status] ?? 'default'}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/40">
                        {formatDate(order.createdAt)} &middot; {order.items.length} item
                        {order.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="font-bold">{formatPrice(order.total)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            href: '/account/orders',
            icon: Package,
            title: 'Order History',
            desc: 'View and track your orders',
          },
          {
            href: '/account/addresses',
            icon: MapPin,
            title: 'Addresses',
            desc: 'Manage saved addresses',
          },
          {
            href: '/account/settings',
            icon: Settings,
            title: 'Account Settings',
            desc: 'Update name, email, or password',
          },
          {
            href: '/account/affiliate',
            icon: Users,
            title: 'Affiliate Program',
            desc: 'Earn commissions on referrals',
          },
          {
            href: '/account/wishlist',
            icon: Heart,
            title: 'Wishlist',
            desc: 'Your saved products',
          },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <div className="glass rounded-2xl p-5 card-hover cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-brand-500/10 flex items-center justify-center">
                  <link.icon className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="font-semibold group-hover:text-brand-400 transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-sm text-white/40">{link.desc}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
