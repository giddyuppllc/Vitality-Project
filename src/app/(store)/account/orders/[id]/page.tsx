import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Package, MapPin, CreditCard, Truck } from 'lucide-react'

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'danger',
  ACCEPTED: 'info',
  FAILED: 'danger',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      shippingAddress: true,
      fulfillments: {
        include: {
          facility: { select: { name: true, city: true, state: true } },
          items: {
            include: { orderItem: { select: { name: true, quantity: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!order || order.userId !== session.user.id) notFound()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/account/orders" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-sm text-white/40">Placed on {formatDate(order.createdAt)}</p>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Badge variant={statusVariant[order.status] ?? 'default'}>
          {order.status}
        </Badge>
        <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>
          Payment: {order.paymentStatus}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <Package className="w-5 h-5 text-brand-400" />
              <h2 className="font-semibold">Items</h2>
            </div>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-white/40">
                      {formatPrice(item.price)} x {item.quantity}
                      {item.sku && <span className="ml-2">SKU: {item.sku}</span>}
                    </p>
                  </div>
                  <p className="font-bold">{formatPrice(item.total)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Shipment Status */}
          {order.fulfillments.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <Truck className="w-5 h-5 text-brand-400" />
                <h2 className="font-semibold">Shipment Status</h2>
              </div>
              <div className="space-y-4">
                {order.fulfillments.map((f, idx) => {
                  const events = [
                    { label: 'Processing', done: true },
                    {
                      label: 'Shipped',
                      done: ['SHIPPED', 'DELIVERED'].includes(f.status),
                      date: f.shippedAt,
                    },
                    {
                      label: 'Delivered',
                      done: f.status === 'DELIVERED',
                      date: f.deliveredAt,
                    },
                  ]
                  return (
                    <div key={f.id} className="border border-white/10 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider">
                            Package {idx + 1} of {order.fulfillments.length}
                          </p>
                          <p className="text-sm font-medium mt-0.5">
                            Ships from {f.facility.name} · {f.facility.city}, {f.facility.state}
                          </p>
                        </div>
                        <Badge variant={statusVariant[f.status] ?? 'default'}>{f.status}</Badge>
                      </div>

                      {/* Items in this shipment */}
                      <div className="text-xs text-white/50 mb-4">
                        {f.items.map((fi) => (
                          <p key={fi.id}>
                            · {fi.orderItem.name} <span className="text-white/30">x{fi.quantity}</span>
                          </p>
                        ))}
                      </div>

                      {/* Timeline */}
                      <div className="flex items-center justify-between mb-4">
                        {events.map((ev, i) => (
                          <div key={i} className="flex-1 flex items-center">
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  ev.done ? 'bg-emerald-400' : 'bg-white/10'
                                }`}
                              />
                              <p
                                className={`text-xs mt-2 whitespace-nowrap ${
                                  ev.done ? 'text-white' : 'text-white/30'
                                }`}
                              >
                                {ev.label}
                              </p>
                              {ev.date && (
                                <p className="text-[10px] text-white/40 mt-0.5">
                                  {formatDate(ev.date)}
                                </p>
                              )}
                            </div>
                            {i < events.length - 1 && (
                              <div
                                className={`flex-1 h-px mx-2 ${
                                  events[i + 1].done ? 'bg-emerald-400/50' : 'bg-white/10'
                                }`}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Tracking */}
                      {f.trackingNumber && (
                        <div className="pt-3 border-t border-white/5 text-sm">
                          <span className="text-white/50">Tracking ({f.carrier || 'Carrier'}):</span>{' '}
                          {f.trackingUrl ? (
                            <a
                              href={f.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-400 hover:underline font-mono"
                            >
                              {f.trackingNumber}
                            </a>
                          ) : (
                            <span className="font-mono text-brand-400">{f.trackingNumber}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-5 h-5 text-brand-400" />
                <h2 className="font-semibold">Shipping Address</h2>
              </div>
              <div className="text-white/70 text-sm space-y-1">
                <p className="text-white font-medium">{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
          )}

          {/* Tracking (legacy single-package view) */}
          {order.trackingNumber && order.fulfillments.length === 0 && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Truck className="w-5 h-5 text-brand-400" />
                <h2 className="font-semibold">Tracking</h2>
              </div>
              <p className="text-sm text-white/70">
                Tracking number:{' '}
                {order.trackingUrl ? (
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline font-mono">
                    {order.trackingNumber}
                  </a>
                ) : (
                  <span className="font-mono text-brand-400">{order.trackingNumber}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="glass rounded-2xl p-6 h-fit sticky top-20">
          <div className="flex items-center gap-3 mb-5">
            <CreditCard className="w-5 h-5 text-brand-400" />
            <h2 className="font-semibold">Payment Summary</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount{order.discountCode && ` (${order.discountCode})`}</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            {order.loyaltyPointsUsed > 0 && (
              <div className="flex justify-between text-purple-400">
                <span>Points ({order.loyaltyPointsUsed})</span>
                <span>-{formatPrice(order.loyaltyPointsUsed)}</span>
              </div>
            )}
            {order.storeCreditUsed > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Store Credit</span>
                <span>-{formatPrice(order.storeCreditUsed)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/50">Shipping</span>
              <span>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</span>
            </div>
            {order.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-white/50">Tax</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
            )}
            <div className="border-t border-white/12 pt-3">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
            {order.loyaltyPointsEarned > 0 && (
              <p className="text-xs text-purple-400 pt-2">
                You earned {order.loyaltyPointsEarned} loyalty points on this order.
              </p>
            )}
          </div>
          {order.paymentId && (
            <p className="text-xs text-white/20 mt-4 break-all">
              Transaction: {order.paymentId}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
