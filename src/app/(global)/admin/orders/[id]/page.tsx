import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TIER_BENEFITS } from '@/lib/membership'
import { OrderActions } from '@/components/admin/order-actions'
import type { MembershipTier } from '@prisma/client'

const MEMBERSHIP_NOTE_PREFIX = 'MEMBERSHIP:'

// Membership invoices are tagged on Order.notes as "MEMBERSHIP:<membershipId>:<tier>"
// (see /api/membership/subscribe + mark-paid). Parse that so the order page can
// show admins which tier this invoice activates.
function parseMembershipNote(
  notes: string | null,
): { membershipId: string; tier: string } | null {
  if (!notes?.startsWith(MEMBERSHIP_NOTE_PREFIX)) return null
  const [, membershipId, tier] = notes.split(':')
  if (!membershipId) return null
  return { membershipId, tier: tier ?? '' }
}

function tierLabel(tier: string): string {
  return (TIER_BENEFITS as Record<string, { label: string }>)[tier]?.label ?? tier
}

function membershipStatusBadge(status: string): {
  variant: 'success' | 'warning' | 'danger' | 'default'
  label: string
} {
  switch (status) {
    case 'ACTIVE':
      return { variant: 'success', label: 'Active' }
    case 'PENDING_PAYMENT':
      return { variant: 'warning', label: 'Awaiting payment' }
    case 'CANCELLED':
      return { variant: 'danger', label: 'Cancelled' }
    case 'PAUSED':
      return { variant: 'default', label: 'Paused' }
    default:
      return { variant: 'default', label: status }
  }
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, slug: true, images: { take: 1 } } } } },
      user: { select: { id: true, name: true, email: true } },
      shippingAddress: true,
    },
  })

  if (!order) notFound()

  // Is this order a membership signup/renewal invoice? Detect via the notes
  // marker (primary) and fall back to a membership whose open invoice points
  // at this order. Pull the live Membership so we can show the requested tier
  // and where it stands (Awaiting payment vs Active).
  const noteInfo = parseMembershipNote(order.notes)
  const membership = await prisma.membership.findFirst({
    where: {
      OR: [
        ...(noteInfo ? [{ id: noteInfo.membershipId }] : []),
        { pendingInvoiceOrderId: order.id },
      ],
    },
    select: {
      id: true,
      userId: true,
      tier: true,
      status: true,
      monthlyPriceCents: true,
      paymentConfirmedAt: true,
    },
  })
  // Requested tier: prefer the note (snapshot at order time), else the live row.
  const requestedTier: MembershipTier | null =
    (noteInfo?.tier as MembershipTier) || membership?.tier || null
  const isMembershipOrder = Boolean(noteInfo || membership)

  // Pull the event timeline: AuditLog rows for this order + lifecycle stamps
  // pulled straight off the Order itself.
  const auditEntries = await prisma.auditLog.findMany({
    where: { entityType: 'Order', entityId: order.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const fulfillments = await prisma.fulfillment.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      carrier: true,
      shippedAt: true,
      createdAt: true,
    },
  })

  type Event = {
    at: Date
    kind: 'placed' | 'paid' | 'shipped' | 'delivered' | 'fulfillment' | 'audit'
    title: string
    detail?: string
    by?: string
  }
  const events: Event[] = []
  events.push({ at: order.createdAt, kind: 'placed', title: 'Order placed' })
  if (order.paymentStatus === 'PAID') {
    events.push({
      at: order.updatedAt,
      kind: 'paid',
      title: 'Payment confirmed',
      detail: order.paymentMethod?.toUpperCase() ?? undefined,
    })
  }
  for (const f of fulfillments) {
    events.push({
      at: f.createdAt,
      kind: 'fulfillment',
      title: `Fulfillment ${f.status}`,
      detail:
        f.trackingNumber
          ? `${f.carrier ?? 'Carrier'} · ${f.trackingNumber}`
          : undefined,
    })
    if (f.shippedAt) {
      events.push({
        at: f.shippedAt,
        kind: 'shipped',
        title: 'Shipped',
        detail: f.trackingNumber
          ? `${f.carrier ?? 'Carrier'} · ${f.trackingNumber}`
          : undefined,
      })
    }
  }
  for (const a of auditEntries) {
    events.push({
      at: a.createdAt,
      kind: 'audit',
      title: a.action,
      detail: a.metadata ?? undefined,
      by: a.userEmail ?? undefined,
    })
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime())

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin/orders" className="text-white/40 hover:text-white transition-colors text-sm">← Orders</a>
        <h1 className="text-2xl font-bold font-mono">{order.orderNumber}</h1>
        <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'SHIPPED' ? 'info' : order.status === 'CANCELLED' ? 'danger' : 'warning'}>
          {order.status}
        </Badge>
        <Badge variant={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'FAILED' ? 'danger' : 'warning'}>
          {order.paymentStatus}
        </Badge>
        {isMembershipOrder && requestedTier && (
          <Badge variant="info">Membership · {tierLabel(requestedTier)}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: items + actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-dark-700 shrink-0 flex items-center justify-center text-white/20 text-xs">VP</div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    {item.sku && <p className="text-xs text-white/40">SKU: {item.sku}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm">{formatPrice(item.price)} × {item.quantity}</p>
                    <p className="font-bold">{formatPrice(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/5 mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-white/50">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-sm text-emerald-400"><span>Discount ({order.discountCode})</span><span>-{formatPrice(order.discount)}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-white/50">Shipping</span><span>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t border-white/5 pt-2"><span>Total</span><span>{formatPrice(order.total)}</span></div>
            </div>
          </div>

          {/* Admin Actions — client component */}
          <OrderActions order={{ id: order.id, status: order.status, paymentStatus: order.paymentStatus, total: order.total, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl, notes: order.notes }} />

          {/* Timeline */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-white/40">No events recorded.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((e, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        e.kind === 'paid'
                          ? 'bg-emerald-400'
                          : e.kind === 'shipped' || e.kind === 'delivered'
                            ? 'bg-brand-400'
                            : e.kind === 'placed'
                              ? 'bg-amber-400'
                              : e.kind === 'fulfillment'
                                ? 'bg-blue-400'
                                : 'bg-white/30'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-white/30 shrink-0">
                          {formatDate(e.at)}
                        </p>
                      </div>
                      {e.detail && (
                        <p className="text-xs text-white/50 mt-0.5 wrap-break-word">
                          {e.detail}
                        </p>
                      )}
                      {e.by && (
                        <p className="text-xs text-white/30 mt-0.5">by {e.by}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Right: customer + shipping */}
        <div className="space-y-6">
          {isMembershipOrder && (
            <div className="glass rounded-2xl p-6 border border-brand-500/20">
              <h2 className="font-semibold mb-1">Membership signup</h2>
              <p className="text-xs text-white/40 mb-4">
                This order is a membership invoice — marking it paid activates
                the tier below.
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Requested tier</span>
                  {requestedTier ? (
                    <Badge variant="info">{tierLabel(requestedTier)}</Badge>
                  ) : (
                    <span className="text-white/40">—</span>
                  )}
                </div>
                {membership && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Membership status</span>
                      <Badge variant={membershipStatusBadge(membership.status).variant}>
                        {membershipStatusBadge(membership.status).label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Monthly</span>
                      <span className="text-white/70">
                        {formatPrice(membership.monthlyPriceCents)}
                      </span>
                    </div>
                    {membership.paymentConfirmedAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">First paid</span>
                        <span className="text-white/50 text-xs">
                          {formatDate(membership.paymentConfirmedAt)}
                        </span>
                      </div>
                    )}
                    <Link
                      href={`/admin/customers/${membership.userId}?tab=overview`}
                      className="inline-flex text-xs text-brand-400 hover:text-brand-300"
                    >
                      View member profile →
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Customer</h2>
            <p className="font-medium">{order.user?.name ?? 'Guest'}</p>
            <p className="text-sm text-white/50">{order.email}</p>
            <div className="mt-3 text-xs text-white/30 space-y-1">
              <p>Payment: <span className="text-white/50">{order.paymentMethod?.toUpperCase()}</span></p>
              <p>Placed: <span className="text-white/50">{formatDate(order.createdAt)}</span></p>
            </div>
            {order.affiliateCode && (
              <div className="mt-3 text-xs">
                <span className="text-white/40">Affiliate: </span>
                <code className="text-brand-400">{order.affiliateCode}</code>
              </div>
            )}
          </div>

          {order.shippingAddress && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-semibold mb-3">Shipping Address</h2>
              <div className="text-sm text-white/60 space-y-1">
                <p className="text-white font-medium">{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
