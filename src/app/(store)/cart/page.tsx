'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash2, ShoppingBag, ArrowRight, LogIn, AlertTriangle, RefreshCw } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useSession } from 'next-auth/react'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type PriceDrift = {
  productId: string
  variantId: string | null
  storedPrice: number
  currentPrice: number | null
  available: boolean
  reason?: string
}

export default function CartPage() {
  const { data: session, status } = useSession()
  const { items, removeItem, updateQuantity, setItemPrice, total, itemCount } = useCart()

  // Stale-price detection: cart stores price at add-to-cart time in
  // localStorage. If admin changed the price since (or archived the
  // product), the customer would see a stale total here AND a different
  // total at checkout. We fetch current server prices and surface drift.
  const [drift, setDrift] = useState<PriceDrift[]>([])
  useEffect(() => {
    if (items.length === 0) {
      setDrift([])
      return
    }
    let cancelled = false
    void fetch('/api/cart/refresh-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? null,
        })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.items) return
        const drifts: PriceDrift[] = []
        for (const r of data.items as Array<{
          productId: string
          variantId: string | null
          currentPrice: number | null
          available: boolean
          reason?: string
        }>) {
          const stored = items.find(
            (i) => i.productId === r.productId && (i.variantId ?? null) === r.variantId,
          )
          if (!stored) continue
          if (!r.available || r.currentPrice == null) {
            drifts.push({ ...r, storedPrice: stored.price })
          } else if (r.currentPrice !== stored.price) {
            drifts.push({ ...r, storedPrice: stored.price })
          }
        }
        setDrift(drifts)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, items.map((i) => `${i.productId}|${i.variantId}|${i.quantity}`).join(',')])

  const acceptUpdatedPrices = () => {
    for (const d of drift) {
      if (d.available && d.currentPrice != null) {
        setItemPrice(d.productId, d.currentPrice, d.variantId ?? undefined)
      } else {
        // Product is unavailable — drop it from the cart so checkout doesn't fail.
        removeItem(d.productId, d.variantId ?? undefined)
      }
    }
    setDrift([])
  }

  // Show sign-in prompt if not authenticated
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

      {/* Price-drift banner: shows when stored cart prices no longer match
          the current server price (admin edit while items sat in cart, or
          a product got archived). One click syncs the cart to current
          prices and drops unavailable items. */}
      {drift.length > 0 && (
        <div className="glass rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-200">
              {drift.length} item{drift.length === 1 ? '' : 's'} in your cart {drift.length === 1 ? 'has' : 'have'} updated pricing or availability since you added {drift.length === 1 ? 'it' : 'them'}.
            </p>
            <ul className="text-sm text-amber-200/80 mt-2 space-y-0.5">
              {drift.map((d) => {
                const stored = items.find(
                  (i) => i.productId === d.productId && (i.variantId ?? null) === d.variantId,
                )
                if (!stored) return null
                return (
                  <li key={`${d.productId}|${d.variantId}`} className="leading-relaxed">
                    <span className="font-medium text-amber-100">{stored.name}</span>
                    {' — '}
                    {d.available && d.currentPrice != null ? (
                      <>
                        was {formatPrice(d.storedPrice)} → now <span className="text-amber-100 font-medium">{formatPrice(d.currentPrice)}</span>
                      </>
                    ) : (
                      <span className="text-red-300">no longer available — will be removed</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
          <button
            onClick={acceptUpdatedPrices}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-400 text-amber-950 text-sm font-semibold hover:bg-amber-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Update cart
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="glass rounded-2xl p-4 flex gap-4">
              {/* Image */}
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-dark-800 shrink-0">
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 text-xs font-bold">VP</div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <Link href={`/products/${item.slug}`} className="font-semibold hover:text-brand-400 transition-colors line-clamp-1">
                  {item.name}
                </Link>
                <p className="text-white/40 text-sm mt-0.5">{formatPrice(item.price)} each</p>

                <div className="flex items-center justify-between mt-3">
                  {/* Qty controls */}
                  <div className="flex items-center gap-2 glass rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                      className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white text-sm"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                      className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white text-sm"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                    <button
                      onClick={() => removeItem(item.productId, item.variantId)}
                      className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="glass rounded-2xl p-6 h-fit sticky top-20">
          <h2 className="font-bold text-lg mb-5">Order Summary</h2>
          <div className="space-y-3 mb-5">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Shipping</span>
              <span className="text-white/40">Calculated at checkout</span>
            </div>
          </div>
          <div className="border-t border-white/12 pt-4 mb-6">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
          <Link href="/checkout">
            <Button size="lg" className="w-full">
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
