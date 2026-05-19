'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Sparkles, Lock, Loader2, ShoppingBag } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { NoRefundsNotice } from '@/components/store/no-refunds-notice'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC','PR',
]

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface PricedCart {
  lines: Array<{
    productId: string
    variantId: string | null
    name: string
    slug: string
    unitPrice: number
    quantity: number
    lineTotal: number
    available: boolean
  }>
  subtotal: number
  bundle: { qualifyingCount: number; discountCents: number; tierLabel: string | null; discountPct: number; nextTier: { remaining: number; pct: number } | null }
  member: { tier: string; discountCents: number }
  totalDiscount: number
  total: number
  unavailableCount: number
}

export default function CheckoutPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const items = useCart((s) => s.items)
  const clearCart = useCart((s) => s.clearCart)

  // Authoritative cart numbers come from /api/cart — never from the client.
  // Cart items in localStorage carry only refs (productId/variantId/quantity).
  const [cart, setCart] = useState<PricedCart | null>(null)
  useEffect(() => {
    if (items.length === 0) {
      setCart(null)
      return
    }
    let cancelled = false
    void fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? null,
          quantity: i.quantity,
        })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PricedCart | null) => {
        if (cancelled) return
        setCart(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [items.length, items.map((i) => `${i.productId}|${i.variantId}|${i.quantity}`).join(',')])

  const [name, setName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [discountCode, setDiscountCode] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Loyalty points redemption state — fetched once on auth, applied at submit.
  const [loyaltyBalance, setLoyaltyBalance] = useState<number>(0)
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0)
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    fetch('/api/account/loyalty')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setLoyaltyBalance(data.points ?? 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (session?.user?.name && !name) setName(session.user.name)
  }, [session?.user?.name, name])

  // All numbers below are pulled straight from /api/cart (server-authoritative).
  // No client-side fallback math — if `cart` is null the UI shows a loader.
  const subtotal = cart?.subtotal ?? 0
  const discount = cart
    ? {
        qualifyingCount: cart.bundle.qualifyingCount ?? 0,
        discountPct: cart.bundle.discountPct,
        discountCents: cart.bundle.discountCents,
        tierLabel: cart.bundle.tierLabel,
        nextTier: cart.bundle.nextTier,
        memberDiscountCents: cart.member.discountCents,
        memberTier: cart.member.tier,
        totalDiscountCents: cart.totalDiscount,
        finalTotalCents: cart.total,
      }
    : null
  const finalTotal = cart?.total ?? 0

  // Sign-in gate
  if (sessionStatus === 'loading') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Loader2 className="w-10 h-10 text-white/30 mx-auto animate-spin" />
      </div>
    )
  }

  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Lock className="w-16 h-16 text-white/10 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3">Sign in to check out</h1>
        <p className="text-white/50 mb-8 max-w-md mx-auto leading-relaxed">
          You need an account to place an order. It takes 30 seconds.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/auth/signin?callbackUrl=${encodeURIComponent('/checkout')}`}>
            <Button size="lg">Sign in</Button>
          </Link>
          <Link href={`/auth/register?callbackUrl=${encodeURIComponent('/checkout')}`}>
            <Button size="lg" variant="outline">Create account</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-white/10 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3">Your cart is empty</h1>
        <p className="text-white/50 mb-8 max-w-md mx-auto leading-relaxed">
          Browse the catalog and add a few items to get started.
        </p>
        <Link href="/products">
          <Button size="lg">
            <Sparkles className="w-5 h-5" />
            Browse products
          </Button>
        </Link>
      </div>
    )
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name || !line1 || !city || !state || !zip) {
      setError('Please fill in all required shipping fields.')
      return
    }
    if (!session?.user?.email) {
      setError('Missing account email. Please sign in again.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/checkout-zelle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          email: session.user.email,
          shippingAddress: {
            name,
            line1,
            line2: line2 || undefined,
            city,
            state,
            zip,
            country: 'US',
          },
          discountCode: discountCode || undefined,
          loyaltyPointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Could not place order')
      }

      clearCart()
      router.push(`/checkout/confirmation?orderId=${result.orderId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place order')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <p className="text-white/50 mt-1 text-sm">
          Pay via Zelle — your order is reserved as soon as you place it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form column */}
        <form
          onSubmit={handlePlaceOrder}
          className="lg:col-span-2 space-y-6"
        >
          {/* Shipping */}
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Shipping address</h2>

            <div className="grid grid-cols-1 gap-4">
              <Field
                label="Full name *"
                value={name}
                onChange={setName}
                placeholder="Jane Doe"
                required
              />
              <Field
                label="Address line 1 *"
                value={line1}
                onChange={setLine1}
                placeholder="123 Main Street"
                required
              />
              <Field
                label="Address line 2"
                value={line2}
                onChange={setLine2}
                placeholder="Apt, suite, unit (optional)"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="City *" value={city} onChange={setCity} required />
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/50 block mb-1.5">
                    State *
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-lg text-white text-sm focus:border-brand focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <Field label="ZIP *" value={zip} onChange={setZip} required />
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Discount code</h2>
            <Field
              label="Got a code?"
              value={discountCode}
              onChange={(v) => setDiscountCode(v.toUpperCase())}
              placeholder="OPTIONAL"
            />
          </div>

          {/* Loyalty points redemption — only visible if customer has any. */}
          {loyaltyBalance > 0 && (
            <div className="glass rounded-2xl p-6 space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Loyalty points</h2>
                <span className="text-sm text-white/50">
                  Balance: <span className="text-white">{loyaltyBalance.toLocaleString()} pts</span>{' '}
                  <span className="text-white/30">(${(loyaltyBalance / 100).toFixed(2)})</span>
                </span>
              </div>
              {(() => {
                // Cap redemption to whichever is smaller: balance, or the
                // amount that would zero out the cart subtotal (don't let
                // shipping/tax go negative).
                const remainingForRedemption = Math.max(
                  0,
                  (discount?.finalTotalCents ?? subtotal) - 0, // points can't reduce shipping/tax below 0; server clamps
                )
                const maxPoints = Math.min(loyaltyBalance, remainingForRedemption)
                const clamped = Math.max(0, Math.min(pointsToRedeem, maxPoints))
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={maxPoints}
                        step={Math.max(1, Math.floor(maxPoints / 100))}
                        value={clamped}
                        onChange={(e) => setPointsToRedeem(parseInt(e.target.value) || 0)}
                        className="flex-1 accent-brand"
                      />
                      <input
                        type="number"
                        min={0}
                        max={maxPoints}
                        value={clamped}
                        onChange={(e) =>
                          setPointsToRedeem(
                            Math.max(0, Math.min(maxPoints, parseInt(e.target.value) || 0)),
                          )
                        }
                        className="w-24 px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white text-right focus:outline-none focus:border-brand-400"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPointsToRedeem(0)}
                          className="px-2 py-1 rounded-md text-white/50 hover:text-white hover:bg-white/5"
                        >
                          None
                        </button>
                        <button
                          type="button"
                          onClick={() => setPointsToRedeem(maxPoints)}
                          className="px-2 py-1 rounded-md text-brand-300 hover:text-brand-200 hover:bg-brand-500/10"
                        >
                          Use max
                        </button>
                      </div>
                      <p className="text-white/40">
                        {clamped > 0 ? (
                          <>
                            <span className="text-emerald-400 font-medium">
                              -${(clamped / 100).toFixed(2)}
                            </span>{' '}
                            applied (100 pts = $1)
                          </>
                        ) : (
                          '100 pts = $1 off'
                        )}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Payment notice */}
          <div className="glass rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-semibold">Payment</h2>
            <div className="rounded-xl border border-brand/40 bg-brand/5 p-4">
              <p className="text-sm font-medium text-white">
                Payment via Zelle
              </p>
              <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                After you place this order, we'll email you the Zelle send-to
                address and your order number to use as the memo. Your items
                ship as soon as funds arrive (usually same day).
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Placing order…
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Place Zelle order — {formatPrice(finalTotal)}+
              </>
            )}
          </Button>

          <p className="text-xs text-white/40 text-center">
            Final total includes shipping + tax, calculated on the next screen.
          </p>
        </form>

        {/* Summary column */}
        <aside className="space-y-4">
          <div className="glass rounded-2xl p-6 space-y-4 lg:sticky lg:top-28">
            <h2 className="text-lg font-semibold">Order summary</h2>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {!cart ? (
                <div className="flex items-center justify-center py-6 text-white/40 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Pricing your cart…
                </div>
              ) : (
                cart.lines.map((line) => (
                  <div key={`${line.productId}|${line.variantId}`} className="flex items-start gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{line.name}</p>
                      <p className="text-white/40 text-xs">
                        Qty {line.quantity} · {formatPrice(line.unitPrice)} ea
                      </p>
                    </div>
                    <p className="font-medium tabular-nums">
                      {formatPrice(line.lineTotal)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="h-px bg-white/10" />

            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatPrice(subtotal)} />

              {/* Auto-applied bundle discount */}
              {discount?.discountCents ? (
                <Row
                  label={
                    <span className="text-emerald-300/90">
                      {discount.tierLabel ?? `Bundle ${discount.discountPct}% off`}
                    </span>
                  }
                  value={
                    <span className="text-emerald-300/90 tabular-nums">
                      −{formatPrice(discount.discountCents)}
                    </span>
                  }
                />
              ) : null}

              {/* Auto-applied member permanent discount */}
              {discount?.memberDiscountCents ? (
                <Row
                  label={
                    <span className="text-fuchsia-300/90">
                      {discount.memberTier} member discount
                    </span>
                  }
                  value={
                    <span className="text-fuchsia-300/90 tabular-nums">
                      −{formatPrice(discount.memberDiscountCents)}
                    </span>
                  }
                />
              ) : null}

              {/* Encouragement to hit the next tier */}
              {discount?.nextTier && discount.nextTier.remaining > 0 ? (
                <p className="text-xs text-white/45 pt-1">
                  Add {discount.nextTier.remaining} more
                  {discount.nextTier.remaining === 1 ? " peptide" : " peptides"} for {discount.nextTier.pct}% off.
                </p>
              ) : null}

              {/* Loyalty points applied */}
              {pointsToRedeem > 0 && (
                <Row
                  label={
                    <span className="text-amber-300/90">
                      Loyalty points ({pointsToRedeem.toLocaleString()})
                    </span>
                  }
                  value={
                    <span className="text-amber-300/90 tabular-nums">
                      −{formatPrice(pointsToRedeem)}
                    </span>
                  }
                />
              )}

              <Row label="Shipping" value="Calculated next" muted />
              <Row label="Tax" value="Calculated next" muted />
            </div>

            <div className="h-px bg-white/10" />

            <Row
              label={<span className="font-semibold">Estimated total</span>}
              value={
                <span className="font-semibold tabular-nums">
                  {formatPrice(Math.max(0, finalTotal - pointsToRedeem))}+
                </span>
              }
            />
          </div>

          <NoRefundsNotice />
        </aside>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-white/50 block mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-lg text-white placeholder:text-white/30 text-sm focus:border-brand focus:outline-none"
      />
    </div>
  )
}

function Row({
  label,
  value,
  muted,
}: {
  label: React.ReactNode
  value: React.ReactNode
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-white/40' : 'text-white/60'}>{label}</span>
      <span className={muted ? 'text-white/40' : ''}>{value}</span>
    </div>
  )
}
