'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Check, Plus, Minus } from 'lucide-react'
import { useCart } from '@/hooks/useCart'

interface Variant {
  id: string
  name: string
  price: number
  inventory: number
}

interface Props {
  product: {
    id: string
    name: string
    price: number
    slug: string
    image?: string
    inventory: number
    variants: Variant[]
  }
}

export function AddToCartButton({ product }: Props) {
  const addItem = useCart((s) => s.addItem)
  const hasVariants = product.variants && product.variants.length > 0
  const [variantId, setVariantId] = useState<string | null>(
    hasVariants ? product.variants[0].id : null,
  )
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const selectedVariant = hasVariants
    ? product.variants.find((v) => v.id === variantId) ?? product.variants[0]
    : null

  const unitPrice = selectedVariant?.price ?? product.price

  const handleAdd = () => {
    // Cart only stores REFS — productId, variantId, quantity + display
    // fields. Price is intentionally NOT passed; the cart and checkout
    // pages always derive prices from /api/cart on the server. The
    // `unitPrice` shown on this button is still server-rendered HTML
    // from the product detail page (force-dynamic), so the customer
    // adds at the price they see.
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name + (selectedVariant ? ` — ${selectedVariant.name}` : ''),
      image: product.image,
      slug: product.slug,
      quantity: qty,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="space-y-4">
      {hasVariants && (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.12em] text-white/45 font-semibold">
            Strength / size
          </label>
          <div className="grid grid-cols-2 gap-2">
            {product.variants.map((v) => {
              // ProductVariant.inventory is a display-only signal here — checkout
              // doesn't gate on it (drop-ship model). inventory>0 = "In Stock"
              // badge (green), inventory===0 = "Pre-order" badge (amber). Customers
              // can buy either way; the badge sets expectations.
              const inStock = v.inventory > 0
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    v.id === variantId
                      ? 'border-brand bg-brand/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/25 hover:text-white'
                  }`}
                  data-testid={`variant-${v.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{v.name}</span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        inStock
                          ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                          : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                      }`}
                    >
                      {inStock ? 'In stock' : 'Pre-order'}
                    </span>
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">${(v.price / 100).toFixed(2)}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-2.5 text-white/60 hover:text-white"
            aria-label="Decrease quantity"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="px-2 min-w-[28px] text-center text-sm tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="px-3 py-2.5 text-white/60 hover:text-white"
            aria-label="Increase quantity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <Button onClick={handleAdd} size="lg" className="flex-1">
          {added ? (
            <>
              <Check className="w-5 h-5" />
              Added — ${((unitPrice * qty) / 100).toFixed(2)}
            </>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              Add to cart — ${((unitPrice * qty) / 100).toFixed(2)}
            </>
          )}
        </Button>
      </div>

      <p className="text-[11px] text-white/35 leading-relaxed">
        Pay via Zelle. After you place the order we email you the send-to address. Items ship same day funds arrive.
      </p>
    </div>
  )
}
