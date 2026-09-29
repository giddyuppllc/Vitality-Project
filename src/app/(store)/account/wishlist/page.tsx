'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, Trash2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWishlist } from '@/hooks/useWishlist'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'

export default function WishlistPage() {
  const { items, remove, clear } = useWishlist()
  const { addItem } = useCart()

  const moveAllToCart = () => {
    items.forEach((it) => {
      // Cart stores refs only — price comes from /api/cart on render.
      addItem({
        productId: it.id,
        name: it.name,
        quantity: 1,
        slug: it.slug,
        image: it.image,
      })
    })
    clear()
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="glass rounded-2xl overflow-hidden flex flex-col"
          >
            <Link href={`/products/${item.slug}`} className="block">
              <div className="relative aspect-square bg-dark-800">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">
                    VP
                  </div>
                )}
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
                <span className="font-bold">{formatPrice(item.price)}</span>
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
        ))}
      </div>
    </div>
  )
}
