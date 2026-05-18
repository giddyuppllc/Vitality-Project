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
  const discountPct = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : null

  // Edward's call (2026-05): every product card uses the same branded
  // peptide-vial image for visual consistency until per-product photography
  // is shot. Overrides any DB ProductImage rows. Reverse by switching back
  // to product.images?.[0] on this line.
  const cardImage = "/products/vial-default-600.png"

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
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-500"
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
          <h3 className="font-semibold text-white mb-2 line-clamp-2">{product.name}</h3>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-white">{formatPrice(product.price)}</span>
              {product.comparePrice && (
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
