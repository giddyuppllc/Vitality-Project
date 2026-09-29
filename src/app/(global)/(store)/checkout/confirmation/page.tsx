import Link from 'next/link'
import { CheckCircle, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import { PurchasePixel } from '@/components/store/purchase-pixel'

interface Props {
  searchParams: Promise<{ order?: string; orderId?: string }>
}

async function getZelleIdentity(): Promise<{
  primary: string
  displayName: string | null
  phone: string | null
}> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ['zelleEmail', 'zelleDisplayName', 'zellePhone'] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value?.trim() || '']))
  const primary =
    map.zelleEmail ||
    map.zellePhone ||
    process.env.ADMIN_EMAIL ||
    'edward@giddyupp.com'
  return {
    primary,
    displayName: map.zelleDisplayName || null,
    phone: map.zelleEmail && map.zellePhone ? map.zellePhone : null,
  }
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const params = await searchParams
  const orderNumber = params.order
  const orderId = params.orderId

  // Resolve by either orderNumber (legacy ?order=) or orderId (new ?orderId=).
  const order = orderNumber
    ? await prisma.order.findUnique({
        where: { orderNumber },
        select: {
          orderNumber: true,
          total: true,
          paymentMethod: true,
          paymentStatus: true,
          items: { select: { quantity: true } },
        },
      })
    : orderId
      ? await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            orderNumber: true,
            total: true,
            paymentMethod: true,
            paymentStatus: true,
            items: { select: { quantity: true } },
          },
        })
      : null

  const resolvedOrderNumber = order?.orderNumber ?? orderNumber ?? null
  const itemCount = order?.items.reduce((n, it) => n + it.quantity, 0) ?? 0
  const isZellePending =
    order?.paymentMethod === 'zelle' && order.paymentStatus !== 'PAID'

  const zelle = isZellePending ? await getZelleIdentity() : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      {/* Conversion pixels only fire on PAID orders to avoid double-counting
          when the customer eventually pays a Zelle order. */}
      {order && resolvedOrderNumber && order.paymentStatus === 'PAID' && (
        <PurchasePixel
          orderNumber={resolvedOrderNumber}
          totalCents={order.total}
          itemCount={itemCount}
        />
      )}

      {isZellePending ? (
        <ZellePendingView
          orderNumber={resolvedOrderNumber}
          totalCents={order?.total ?? 0}
          zelleIdentity={zelle!}
        />
      ) : (
        <PaidView orderNumber={resolvedOrderNumber} />
      )}
    </div>
  )
}

function ZellePendingView({
  orderNumber,
  totalCents,
  zelleIdentity,
}: {
  orderNumber: string | null
  totalCents: number
  zelleIdentity: { primary: string; displayName: string | null; phone: string | null }
}) {
  return (
    <>
      <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
        <Clock className="w-10 h-10 text-amber-400" />
      </div>

      <h1 className="text-3xl font-bold mb-2">Order received — send Zelle to complete</h1>
      <p className="text-white/50 mb-6">
        We've reserved your items. Send Zelle below and we'll ship as soon as
        funds arrive (usually same day).
      </p>

      {orderNumber && (
        <div className="inline-block bg-dark-700 rounded-xl px-5 py-2 font-mono font-bold text-brand-400 text-lg mb-8">
          {orderNumber}
        </div>
      )}

      <div className="glass rounded-2xl p-8 text-left mb-8 space-y-6">
        {zelleIdentity.displayName && (
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
              Recipient name
            </p>
            <p className="text-lg font-semibold">{zelleIdentity.displayName}</p>
          </div>
        )}

        {zelleIdentity.displayName && <div className="h-px bg-white/10" />}

        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
            Send Zelle to
          </p>
          <p className="font-mono text-xl font-bold break-all">
            {zelleIdentity.primary}
          </p>
          {zelleIdentity.phone && (
            <p className="text-sm text-white/50 mt-1">
              or by phone: <span className="font-mono">{zelleIdentity.phone}</span>
            </p>
          )}
        </div>

        <div className="h-px bg-white/10" />

        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
            Memo / note (REQUIRED)
          </p>
          <p className="font-mono text-xl font-bold">
            {orderNumber ? `#${orderNumber}` : '(see your email)'}
          </p>
          <p className="text-xs text-white/40 mt-2 leading-relaxed">
            Without this memo we can't match your payment to this order, and
            fulfillment will be delayed.
          </p>
        </div>

        <div className="h-px bg-white/10" />

        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
            Amount
          </p>
          <p className="font-mono text-2xl font-bold">
            ${(totalCents / 100).toFixed(2)}
          </p>
        </div>
      </div>

      <p className="text-sm text-white/40 mb-8">
        We've also emailed these instructions. Reply to that email with any
        questions.
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <Link href="/account/orders">
          <Button>View My Orders</Button>
        </Link>
        <Link href="/products">
          <Button variant="secondary">
            Continue Shopping <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </>
  )
}

function PaidView({ orderNumber }: { orderNumber: string | null }) {
  return (
    <>
      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-emerald-400" />
      </div>

      <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
      <p className="text-white/50 mb-2">
        Your order has been confirmed and is being processed.
      </p>
      <div className="inline-block bg-dark-700 rounded-xl px-5 py-2 font-mono font-bold text-brand-400 text-lg mb-10">
        {orderNumber ?? 'Order not found — please check your email'}
      </div>

      <div className="glass rounded-2xl p-8 text-left mb-8">
        <h2 className="text-xl font-bold mb-4">What happens next?</h2>
        <div className="space-y-3 text-white/70 text-sm">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <p>You&apos;ll receive a confirmation email with your order details and receipt.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <p>Our team will prepare your order for shipment.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <p>You&apos;ll receive tracking information once your order ships.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 text-sm text-white/40 mb-10">
        <p>Questions about your order? Contact us anytime.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <Link href="/account/orders">
          <Button>View Orders</Button>
        </Link>
        <Link href="/products">
          <Button variant="secondary">
            Continue Shopping <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </>
  )
}
