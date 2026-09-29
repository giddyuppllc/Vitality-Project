export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { DollarSign, ShoppingBag, MapPin, Users, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function BusinessOverviewPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!membership) redirect('/business/apply')

  const org = membership.organization
  const isPending = org.status === 'SUSPENDED'
  const isActive = org.status === 'ACTIVE'

  // Fetch stats only if active
  const [locationCount, staffCount, orders, commissions] = isActive
    ? await Promise.all([
        prisma.location.count({ where: { organizationId: org.id } }),
        prisma.orgMember.count({ where: { organizationId: org.id } }),
        prisma.order.findMany({
          where: { organizationId: org.id },
          include: { items: { take: 1 } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.orderCommission.aggregate({
          where: { location: { organizationId: org.id } },
          _sum: { amount: true },
          _count: true,
        }),
      ])
    : [0, 0, [], { _sum: { amount: null }, _count: 0 }]

  const statusVariant = isPending ? 'warning' : isActive ? 'success' : 'danger'
  const statusLabel = isPending ? 'PENDING REVIEW' : org.status

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            <span className="text-sm text-white/40">{org.type.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="glass rounded-2xl p-6 mb-8 border border-amber-500/20">
          <div className="flex items-start gap-4">
            <Clock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-400 mb-1">Application Under Review</h3>
              <p className="text-white/50 text-sm">
                Your business application is currently being reviewed by our team.
                You will receive an email once your account has been approved.
                This typically takes 2-3 business days.
              </p>
            </div>
          </div>
        </div>
      )}

      {isActive && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/40">Total Commissions</span>
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold">
                {formatPrice(commissions._sum.amount ?? 0)}
              </div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/40">Orders</span>
                <ShoppingBag className="w-5 h-5 text-brand-400" />
              </div>
              <div className="text-2xl font-bold">{commissions._count}</div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/40">Active Locations</span>
                <MapPin className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-2xl font-bold">{locationCount}</div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/40">Staff Members</span>
                <Users className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold">{staffCount}</div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="glass rounded-2xl p-6 mb-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-brand-400" /> Recent Orders
            </h2>
            {orders.length === 0 ? (
              <p className="text-white/30 text-sm">No orders yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Order</th>
                      <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 text-sm font-mono">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-white/70">{order.email}</td>
                        <td className="px-4 py-3 text-sm font-bold">{formatPrice(order.total)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : 'warning'}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/40">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/business/locations/new" className="glass rounded-2xl p-5 hover:bg-white/5 transition-all group">
              <MapPin className="w-5 h-5 text-brand-400 mb-2" />
              <h3 className="font-medium group-hover:text-brand-400 transition-colors">Add Location</h3>
              <p className="text-xs text-white/40 mt-1">Set up a new kiosk location</p>
            </Link>
            <Link href="/business/staff" className="glass rounded-2xl p-5 hover:bg-white/5 transition-all group">
              <Users className="w-5 h-5 text-purple-400 mb-2" />
              <h3 className="font-medium group-hover:text-purple-400 transition-colors">Manage Staff</h3>
              <p className="text-xs text-white/40 mt-1">Invite and manage team members</p>
            </Link>
            <Link href="/business/commissions" className="glass rounded-2xl p-5 hover:bg-white/5 transition-all group">
              <DollarSign className="w-5 h-5 text-emerald-400 mb-2" />
              <h3 className="font-medium group-hover:text-emerald-400 transition-colors">View Commissions</h3>
              <p className="text-xs text-white/40 mt-1">Track your earnings</p>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
