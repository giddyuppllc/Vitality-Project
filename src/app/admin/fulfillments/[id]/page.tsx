import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { FulfillmentActions } from '@/components/admin/fulfillment-actions'
import { ArrowLeft, Package, MapPin } from 'lucide-react'

export default async function AdminFulfillmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const fulfillment = await prisma.fulfillment.findUnique({
    where: { id },
    include: {
      facility: true,
      order: {
        include: {
          user: { select: { name: true, email: true } },
          shippingAddress: true,
        },
      },
      items: {
        include: {
          orderItem: { select: { name: true, sku: true, price: true, quantity: true, total: true } },
        },
      },
    },
  })

  if (!fulfillment) notFound()

  const statusVariant = (s: string) =>
    s === 'DELIVERED' ? 'success' :
    s === 'SHIPPED' ? 'info' :
    s === 'CANCELLED' || s === 'FAILED' ? 'danger' :
    s === 'PROCESSING' || s === 'ACCEPTED' ? 'info' : 'warning'

  // Timeline events
  const events = [
    { label: 'Created', date: fulfillment.createdAt, done: true },
    {
      label: 'Accepted',
      date: null,
      done: ['ACCEPTED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(fulfillment.status),
    },
    {
      label: 'Processing',
      date: null,
      done: ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(fulfillment.status),
    },
    { label: 'Shipped', date: fulfillment.shippedAt, done: ['SHIPPED', 'DELIVERED'].includes(fulfillment.status) },
    { label: 'Delivered', date: fulfillment.deliveredAt, done: fulfillment.status === 'DELIVERED' },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/fulfillments" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Fulfillment</h1>
        <Badge variant={statusVariant(fulfillment.status)}>{fulfillment.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <Package className="w-5 h-5 text-brand-400" />
              <h2 className="font-semibold">Items ({fulfillment.items.length})</h2>
            </div>
            <div className="space-y-3">
              {fulfillment.items.map((fi) => (
                <div key={fi.id} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{fi.orderItem.name}</p>
                    {fi.orderItem.sku && (
                      <p className="text-xs text-white/40 font-mono">SKU: {fi.orderItem.sku}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatPrice(fi.orderItem.price)} × {fi.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-5">Timeline</h2>
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${ev.done ? 'bg-emerald-400' : 'bg-white/10'}`}
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${ev.done ? 'text-white' : 'text-white/30'}`}>{ev.label}</p>
                  </div>
                  {ev.date && (
                    <p className="text-xs text-white/40">{formatDate(ev.date)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <FulfillmentActions
            fulfillment={{
              id: fulfillment.id,
              status: fulfillment.status,
              trackingNumber: fulfillment.trackingNumber,
              trackingUrl: fulfillment.trackingUrl,
              carrier: fulfillment.carrier,
              notes: fulfillment.notes,
            }}
          />
        </div>

        <div className="space-y-6">
          {/* Order info */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Order</h2>
            <Link
              href={`/admin/orders/${fulfillment.orderId}`}
              className="text-brand-400 hover:underline font-mono text-sm"
            >
              {fulfillment.order.orderNumber}
            </Link>
            <p className="text-sm text-white/60 mt-2">
              {fulfillment.order.user?.name ?? 'Guest'}
            </p>
            <p className="text-xs text-white/40">{fulfillment.order.email}</p>
            <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/50">
              Total: <span className="text-white font-bold">{formatPrice(fulfillment.order.total)}</span>
            </div>
          </div>

          {/* Facility info */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Facility</h2>
            <Link
              href={`/admin/facilities/${fulfillment.facilityId}`}
              className="text-brand-400 hover:underline text-sm font-medium"
            >
              {fulfillment.facility.name}
            </Link>
            <div className="text-xs text-white/50 mt-2 space-y-0.5">
              <p>{fulfillment.facility.addressLine1}</p>
              {fulfillment.facility.addressLine2 && <p>{fulfillment.facility.addressLine2}</p>}
              <p>
                {fulfillment.facility.city}, {fulfillment.facility.state} {fulfillment.facility.zip}
              </p>
              <p>{fulfillment.facility.email}</p>
              {fulfillment.facility.licenseNumber && (
                <p className="font-mono">License: {fulfillment.facility.licenseNumber}</p>
              )}
            </div>
          </div>

          {/* Ship-to */}
          {fulfillment.order.shippingAddress && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-400" /> Ship To
              </h2>
              <div className="text-sm text-white/60 space-y-0.5">
                <p className="text-white font-medium">{fulfillment.order.shippingAddress.name}</p>
                <p>{fulfillment.order.shippingAddress.line1}</p>
                {fulfillment.order.shippingAddress.line2 && (
                  <p>{fulfillment.order.shippingAddress.line2}</p>
                )}
                <p>
                  {fulfillment.order.shippingAddress.city}, {fulfillment.order.shippingAddress.state}{' '}
                  {fulfillment.order.shippingAddress.zip}
                </p>
                <p>{fulfillment.order.shippingAddress.country}</p>
              </div>
            </div>
          )}

          {/* Tracking display */}
          {fulfillment.trackingNumber && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-semibold mb-3">Tracking</h2>
              <p className="text-sm text-white/50">Carrier: {fulfillment.carrier ?? 'Unknown'}</p>
              <p className="text-sm mt-2">
                {fulfillment.trackingUrl ? (
                  <a
                    href={fulfillment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:underline font-mono"
                  >
                    {fulfillment.trackingNumber}
                  </a>
                ) : (
                  <span className="font-mono text-brand-400">{fulfillment.trackingNumber}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
