'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ProductWithImages } from '@/types'

interface ProductCardProps {
  product: ProductWithImages
}

export function ProductCard({ product }: ProductCardProps) {
  // Card displays the lowest variant price as the "from" price so removing
  // a variant in admin automatically corrects the card without a separate
  // Product.price recompute. Falls back to Product.price if no variants.
  const variantPrices = product.variants?.map((v) => v.price).filter((n) => n > 0) ?? []
  const fromPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : product.price

  const discountPct = product.comparePrice && product.comparePrice > fromPrice
    ? Math.round(((product.comparePrice - fromPrice) / product.comparePrice) * 100)
    : null

  // Variant labels (e.g. "5 mg, 10 mg, 30 mg") so customers can see sizes
  // on the listing page without clicking through. Sorted by price ascending.
  const variantLabels = (product.variants ?? [])
    .slice()
    .sort((a, b) => a.price - b.price)
    .map((v) => v.name)

  // Use the product's own primary image (first by position) when one has been
  // uploaded in admin; otherwise fall back to the shared default vial so
  // image-less products look exactly as before. Real photos fill the tile
  // (cover); the transparent default vial stays padded/contained.
  const uploadedImage = product.images?.[0]?.url
  const cardImage = uploadedImage || "/products/vial-default-600.png"

  return (
    <Link href={`/products/${product.slug}`}>
      <div className="group glass rounded-2xl overflow-hidden card-hover cursor-pointer">
        {/* Image */}
        <div className="relative aspect-square bg-dark-800">
          <Image
            src={cardImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`${uploadedImage ? 'object-cover' : 'object-contain p-4'} group-hover:scale-105 transition-transform duration-500`}
          />

          {discountPct && (
            <div className="absolute top-3 left-3 bg-brand-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
              -{discountPct}%
            </div>
          )}

          {/* Reta now has partial stock (10mg + 20mg). The detail page banner
              and per-variant "In stock" / "Pre-order" badges cover the nuance —
              the listing card no longer flags pre-order globally. */}

        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            {product.category && (
              <p className="text-xs text-brand-400 uppercase tracking-wider">{product.category.name}</p>
            )}
            <span className="text-[10px] text-white/25 font-medium tracking-wide">RUO</span>
          </div>
          <h3 className="font-semibold text-white mb-1.5 line-clamp-2">{product.name}</h3>
          {variantLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {variantLabels.map((label) => (
                <span
                  key={label}
                  className="inline-block text-[10px] font-medium text-white/55 bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              {variantLabels.length > 1 && (
                <span className="text-[11px] text-white/40 uppercase tracking-wider">from</span>
              )}
              <span className="font-bold text-white">{formatPrice(fromPrice)}</span>
              {product.comparePrice && product.comparePrice > fromPrice && (
                <span className="text-sm text-white/40 line-through">{formatPrice(product.comparePrice)}</span>
              )}
            </div>
            <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ShoppingCart className="w-3.5 h-3.5" />
              View
            </Button>
          </div>
        </div>
      </div>
    </Link>
  )
}
