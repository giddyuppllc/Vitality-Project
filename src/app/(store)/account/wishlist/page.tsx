'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Trash2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWishlist } from '@/hooks/useWishlist'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import { displayPrice, sellableVariants } from '@/lib/display-price'
import { productImage, isFallbackImage } from '@/lib/product-image'

interface LiveProduct {
  id: string
  price: number
  variants: { id: string; name: string; price: number }[]
}

export default function WishlistPage() {
  const { items, remove } = useWishlist()
  const { addItem } = useCart()
  // Current product data from the server. The local wishlist stores the price
  // at the moment the heart was tapped, which goes stale; and it has no sizes.
  const [live, setLive] = useState<Record<string, LiveProduct>>({})
  const [notice, setNotice] = useState('')

  const idKey = items.map((i) => i.id).join(',')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!idKey) return
    let cancelled = false
    // Only ACTIVE products come back, so a missing id = no longer sold.
    fetch(`/api/products?ids=${encodeURIComponent(idKey)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: LiveProduct[]) => {
        if (cancelled || !Array.isArray(rows)) return
        const map: Record<string, LiveProduct> = {}
        for (const p of rows) map[p.id] = p
        setLive(map)
        setLoaded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [idKey])

  // An item can go straight to the cart only when there is exactly one thing
  // to buy: no sizes, or a single sellable size. It used to add every item
  // with NO size, and the cart then priced a sized product at the stale
  // Product.price (e.g. Selank at $45 when its only size is $74). Items with
  // several sizes stay here with a "Choose size" link.
  const cartRef = (productId: string) => {
    const p = live[productId]
    if (!p) return null
    if (p.variants.length === 0) return p.price > 0 ? { variantId: undefined, suffix: '' } : null
    const sellable = sellableVariants(p.variants)
    if (sellable.length !== 1) return null
    return { variantId: sellable[0].id, suffix: ` — ${sellable[0].name}` }
  }

  const moveAllToCart = () => {
    let moved = 0
    let kept = 0
    items.forEach((it) => {
      const ref = cartRef(it.id)
      if (!ref) {
        kept++
        return
      }
      // Cart stores refs only — price comes from /api/cart on render.
      addItem({
        productId: it.id,
        variantId: ref.variantId,
        name: it.name + ref.suffix,
        quantity: 1,
        slug: it.slug,
        image: it.image,
      })
      remove(it.id)
      moved++
    })
    setNotice(
      kept > 0
        ? `${moved} moved to your cart. ${kept} ${kept === 1 ? "needs" : "need"} a size chosen on the product page.`
        : `${moved} moved to your cart.`,
    )
  }

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Wishlist</h1>
        <div className="glass rounded-2xl p-10 text-center">
          <Heart className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No saved items</h2>
          <p className="text-white/40 mb-6 max-w-md mx-auto">
            Save products you&apos;re interested in by tapping the heart icon.
            We&apos;ll keep them here on this device.
          </p>
          <Link
            href="/products"
            className="text-brand-400 hover:text-brand-300 text-sm transition-colors"
          >
            Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Wishlist</h1>
          <p className="text-white/40 text-sm mt-1">{items.length} saved</p>
        </div>
        <Button onClick={moveAllToCart} variant="outline">
          <ShoppingCart className="w-4 h-4" /> Move all to cart
        </Button>
      </div>
      {notice && (
        <p role="status" className="mb-4 text-sm text-white/60">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const p = live[item.id]
          // Before the fetch lands show the saved price; after it, a missing
          // product is no longer sold.
          const price = p ? displayPrice(p) : loaded ? null : item.price
          const multiSize = p ? sellableVariants(p.variants).length > 1 : false
          return (
          <div
            key={item.id}
            className="glass rounded-2xl overflow-hidden flex flex-col"
          >
            <Link href={`/products/${item.slug}`} className="block">
              <div className="relative aspect-square bg-dark-800">
                <Image
                  src={productImage(item.image ? { images: [{ url: item.image }] } : null)}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className={isFallbackImage(item.image ? { images: [{ url: item.image }] } : null) ? 'object-contain p-6' : 'object-cover'}
                />
              </div>
            </Link>
            <div className="p-4 flex-1 flex flex-col">
              <Link
                href={`/products/${item.slug}`}
                className="font-semibold line-clamp-2 hover:text-brand-400 transition-colors flex-1"
              >
                {item.name}
              </Link>
              <div className="flex items-center justify-between mt-3">
                {price !== null && price !== undefined ? (
                  <span className="font-bold">
                    {multiSize && <span className="text-xs font-normal text-white/40 mr-1">from</span>}
                    {formatPrice(price)}
                  </span>
                ) : (
                  <span className="text-sm text-white/40">Currently unavailable</span>
                )}
                {multiSize && (
                  <Link href={`/products/${item.slug}`} className="text-xs text-brand-400 hover:text-brand-300">
                    Choose size
                  </Link>
                )}
                <button
                  onClick={() => remove(item.id)}
                  className="p-2 text-white/40 hover:text-red-400 transition-colors"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
