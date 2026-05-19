'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash2, ShoppingBag, ArrowRight, LogIn, AlertTriangle, Loader2 } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useSession } from 'next-auth/react'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PricedLine {
  productId: string
  variantId: string | null
  name: string
  slug: string
  image: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
  available: boolean
  reason?: string
}

interface PricedCart {
  lines: PricedLine[]
  subtotal: number
  bundle: { discountCents: number; tierLabel: string | null; discountPct: number; nextTier: { remaining: number; pct: number } | null }
  member: { tier: string; discountCents: number }
  totalDiscount: number
  total: number
  unavailableCount: number
}

export default function CartPage() {
  const { data: session, status } = useSession()
  const { items, removeItem, updateQuantity, itemCount } = useCart()

  // The cart's authoritative state lives on the server. We POST our refs
  // (productId / variantId / quantity) and render whatever comes back.
  // No prices are ever derived from local state — eliminates the entire
  // class of "stale price" bugs. See plan: eventual-floating-beaver.md.
  const [cart, setCart] = useState<PricedCart | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (items.length === 0) {
      setCart(null)
      return
    }
    let cancelled = false
    setLoading(true)
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
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // re-run whenever any ref changes (add/remove/qty)
  }, [items.length, items.map((i) => `${i.productId}|${i.variantId}|${i.quantity}`).join(',')])

  const removeUnavailable = () => {
    if (!cart) return
    for (const l of cart.lines) {
      if (!l.available) removeItem(l.productId, l.variantId ?? undefined)
    }
  }

  if (status !== 'loading' && !session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <LogIn className="w-16 h-16 text-white/10 mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">Sign in to view your cart</h1>
        <p className="text-white/40 mb-8">You need an account to add items and checkout.</p>
        <Link href="/auth/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-white/10 mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-white/40 mb-8">Add some products to get started.</p>
        <Link href="/products">
          <Button>Browse Products</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold mb-8">Cart ({itemCount} items)</h1>

      {/* Unavailable-items notice — only shown when a product was archived
          since the customer added it. */}
      {cart && cart.unavailableCount > 0 && (
        <div className="glass rounded-2xl border border-red-400/40 bg-red-500/10 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-200">
              {cart.unavailableCount} item{cart.unavailableCount === 1 ? ' is' : 's are'} no longer available
            </p>
            <ul className="text-sm text-red-200/80 mt-1 space-y-0.5">
              {cart.lines.filter((l) => !l.available).map((l) => (
                <li key={`${l.productId}|${l.variantId}`}>{l.name}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={removeUnavailable}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-400 text-red-950 text-sm font-semibold hover:bg-red-300 transition-colors"
          >
            Remove
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items — rendered from server data; quantity controls still use local cart actions */}
        <div className="lg:col-span-2 space-y-4">
          {cart?.lines.map((line) => (
            <div
              key={`${line.productId}|${line.variantId}`}
              className={`glass rounded-2xl p-4 flex gap-4 ${!line.available ? 'opacity-60' : ''}`}
            >
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-dark-800 shrink-0">
                {line.image ? (
                  <Image src={line.image} alt={line.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 text-xs font-bold">VP</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <Link href={`/products/${line.slug}`} className="font-semibold hover:text-brand-400 transition-colors line-clamp-1">
                  {line.name}
                </Link>
                <p className="text-white/40 text-sm mt-0.5">
                  {line.available ? `${formatPrice(line.unitPrice)} each` : 'Unavailable'}
                </p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 glass rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(line.productId, line.quantity - 1, line.variantId ?? undefined)}
                      className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white text-sm"
                      disabled={!line.available}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{line.quantity}</span>
                    <button
                      onClick={() => updateQuantity(line.productId, line.quantity + 1, line.variantId ?? undefined)}
                      className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white text-sm"
                      disabled={!line.available}
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {line.available && (
                      <span className="font-bold">{formatPrice(line.lineTotal)}</span>
                    )}
                    <button
                      onClick={() => removeItem(line.productId, line.variantId ?? undefined)}
                      className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Render a thin loading shimmer if the server is still computing */}
          {loading && !cart && items.map((item) => (
            <div key={item.id} className="glass rounded-2xl p-4 flex gap-4 animate-pulse">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-dark-800 shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="h-4 w-2/3 bg-white/10 rounded" />
                <div className="h-3 w-1/4 bg-white/10 rounded mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Summary — every number sourced from /api/cart */}
        <div className="glass rounded-2xl p-6 h-fit sticky top-20">
          <h2 className="font-bold text-lg mb-5">Order Summary</h2>
          {!cart ? (
            <div className="flex items-center justify-center py-8 text-white/40">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Subtotal</span>
                  <span>{formatPrice(cart.subtotal)}</span>
                </div>

                {cart.bundle.discountCents > 0 && (
                  <div className="flex justify-between text-sm text-emerald-300/90">
                    <span>{cart.bundle.tierLabel ?? `Bundle ${cart.bundle.discountPct}% off`}</span>
                    <span>−{formatPrice(cart.bundle.discountCents)}</span>
                  </div>
                )}

                {cart.member.discountCents > 0 && (
                  <div className="flex justify-between text-sm text-fuchsia-300/90">
                    <span>{cart.member.tier} member discount</span>
                    <span>−{formatPrice(cart.member.discountCents)}</span>
                  </div>
                )}

                {cart.bundle.nextTier && cart.bundle.nextTier.remaining > 0 && (
                  <p className="text-xs text-white/45 pt-1">
                    Add {cart.bundle.nextTier.remaining} more for {cart.bundle.nextTier.pct}% off
                  </p>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Shipping</span>
                  <span className="text-white/40">Calculated at checkout</span>
                </div>
              </div>
              <div className="border-t border-white/12 pt-4 mb-6">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatPrice(cart.total)}</span>
                </div>
              </div>
            </>
          )}
          <Link href="/checkout">
            <Button size="lg" className="w-full" disabled={!cart || cart.unavailableCount > 0}>
              Checkout <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/products" className="block text-center text-sm text-white/40 hover:text-white mt-4 transition-colors">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
