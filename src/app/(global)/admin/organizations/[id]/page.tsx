export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'
import { Building2, MapPin, Users, DollarSign, ShoppingBag } from 'lucide-react'
import { OrgAdminActions } from '@/components/admin/org-admin-actions'

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      locations: {
        include: {
          _count: { select: { devices: true, orders: true } },
        },
      },
      members: {
        include: {
          user: { select: { name: true, email: true } },
          location: { select: { name: true } },
        },
      },
    },
  })

  if (!org) notFound()

  // Get orders through this org
  const orders = await prisma.order.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Get commission totals
  const locationIds = org.locations.map((l) => l.id)
  const commissions = locationIds.length > 0
    ? await prisma.orderCommission.aggregate({
        where: { locationId: { in: locationIds } },
        _sum: { amount: true },
        _count: true,
      })
    : { _sum: { amount: null }, _count: 0 }

  const pendingCommissions = locationIds.length > 0
    ? await prisma.orderCommission.aggregate({
        where: { locationId: { in: locationIds }, status: 'PENDING' },
        _sum: { amount: true },
      })
    : { _sum: { amount: null } }

  const statusVariant = org.status === 'ACTIVE' ? 'success' : 'warning'
  const statusLabel = org.status === 'SUSPENDED' ? 'PENDING' : org.status

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>
          <p className="text-white/40 text-sm">
            {org.type.replace('_', ' ')} &middot; Slug: {org.slug} &middot; Created: {formatDate(org.createdAt)}
          </p>
        </div>
        <OrgAdminActions orgId={org.id} currentStatus={org.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Locations</span>
            <MapPin className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold">{org.locations.length}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Staff</span>
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold">{org.members.length}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Total Commissions</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold">{formatPrice(commissions._sum.amount ?? 0)}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40">Pending Commissions</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold">{formatPrice(pendingCommissions._sum.amount ?? 0)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Locations */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-400" /> Locations
          </h2>
          {org.locations.length === 0 ? (
            <p className="text-white/30 text-sm">No locations yet</p>
          ) : (
            <div className="space-y-3">
              {org.locations.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{loc.name}</p>
                    <p className="text-xs text-white/40">{[loc.city, loc.state].filter(Boolean).join(', ')}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="info">{Math.round(loc.commissionRate * 100)}% commission</Badge>
                    <p className="text-xs text-white/40 mt-1">
                      {loc._count.devices} device{loc._count.devices !== 1 ? 's' : ''} &middot; {loc._count.orders} order{loc._count.orders !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" /> Staff Members
          </h2>
          {org.members.length === 0 ? (
            <p className="text-white/30 text-sm">No staff members</p>
          ) : (
            <div className="space-y-3">
              {org.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{member.user.name || 'N/A'}</p>
                    <p className="text-xs text-white/40">{member.user.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={member.role === 'OWNER' ? 'info' : 'default'}>{member.role}</Badge>
                    {member.location && (
                      <p className="text-xs text-white/40 mt-1">{member.location.name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Orders */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-brand-400" /> Order History
        </h2>
        {orders.length === 0 ? (
          <p className="text-white/30 text-sm">No orders through this organization yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Channel</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-white/60">{order.email}</td>
                    <td className="px-4 py-3 text-sm font-bold">{formatPrice(order.total)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{order.salesChannel.replace('_', ' ')}</Badge>
                    </td>
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
    </div>
  )
}
