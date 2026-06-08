import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { AddToCartButton } from '@/components/store/add-to-cart-button'
import { WishlistButton } from '@/components/store/wishlist-button'
import { Badge } from '@/components/ui/badge'
import { Shield, Package, Zap, Edit3 } from 'lucide-react'
import type { Metadata } from 'next'
import { getRelatedProducts } from '@/lib/recommendations'
import { PairWithAntiInflammatory } from '@/components/store/pair-with-anti-inflammatory'
import { NoRefundsNotice } from '@/components/store/no-refunds-notice'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

interface Props {
  params: Promise<{ slug: string }>
}

async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug, status: 'ACTIVE' },
    include: {
      images: { orderBy: { position: 'asc' } },
      category: true,
      variants: true,
      reviews: {
        where: { approved: true },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) return {}
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDesc ?? product.shortDesc ?? undefined,
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const mainImage = product.images[0]
  const inStock = product.inventory > 0 || product.variants.some((v) => v.inventory > 0)
  const discountPct = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : null

  const related = await getRelatedProducts(product.id, 4)

  // Determine if current user has purchased this product (to show review button)
  const session = await getServerSession(authOptions)
  let canReview = false
  let alreadyReviewed = false
  if (session?.user?.id) {
    const purchase = await prisma.orderItem.findFirst({
      where: {
        productId: product.id,
        order: { userId: session.user.id, paymentStatus: 'PAID' },
      },
      select: { id: true },
    })
    canReview = !!purchase
    if (canReview) {
      const existing = await prisma.review.findFirst({
        where: { productId: product.id, userId: session.user.id },
        select: { id: true },
      })
      alreadyReviewed = !!existing
    }
  }

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDesc || product.description?.slice(0, 500) || product.name,
    sku: product.sku || product.id,
    image: product.images.map((i) => i.url),
    url: `${APP_URL}/products/${product.slug}`,
    brand: {
      '@type': 'Brand',
      name: 'The Vitality Project',
    },
    offers: {
      '@type': 'Offer',
      url: `${APP_URL}/products/${product.slug}`,
      priceCurrency: 'USD',
      price: (product.price / 100).toFixed(2),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(product.reviews.length > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: (
          product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
        ).toFixed(1),
        reviewCount: product.reviews.length,
      },
    }),
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Images */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-2xl overflow-hidden glass">
            <Image
              src={mainImage?.url ?? "/products/vial-default.png"}
              alt={mainImage?.alt ?? product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-6"
              priority
            />
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {product.images.slice(0, 4).map((img, i) => (
                <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden glass">
                  <Image src={img.url} alt={img.alt ?? product.name} fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          {product.category && (
            <Badge variant="info">{product.category.name}</Badge>
          )}

          <div>
            <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
            {product.sku && <p className="text-white/30 text-sm">SKU: {product.sku}</p>}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold">{formatPrice(product.price)}</span>
            {product.comparePrice && (
              <>
                <span className="text-xl text-white/40 line-through">{formatPrice(product.comparePrice)}</span>
                <Badge variant="success">-{discountPct}%</Badge>
              </>
            )}
          </div>

          {/* Availability */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${inStock ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className={`text-sm ${inStock ? 'text-emerald-400' : 'text-red-400'}`}>
              {inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>

          {/* Partial-stock notice — 10mg + 20mg in stock; larger sizes on pre-order. */}
          {product.slug === 'retatrutide' && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200/90">
              <p className="font-semibold text-amber-200 mb-1">
                10 mg + 20 mg in stock now.
              </p>
              <p className="text-amber-200/80 leading-relaxed">
                30 mg and larger sizes ship in 3–4 weeks. Select your size below — in-stock options ship within 2 business days.
              </p>
            </div>
          )}

          {/* Short description */}
          {product.shortDesc && (
            <p className="text-white/60 leading-relaxed">{product.shortDesc}</p>
          )}

          {/* Add to cart */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  slug: product.slug,
                  image: mainImage?.url,
                  inventory: product.inventory,
                  variants: product.variants,
                }}
              />
            </div>
            <WishlistButton
              product={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                price: product.price,
                image: mainImage?.url,
              }}
              size="lg"
            />
          </div>

          {/* All-sales-final notice — compact, links to full policy */}
          <NoRefundsNotice variant="compact" />

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
            {[
              { icon: Shield, label: 'Private & Secure' },
              { icon: Package, label: 'Discreet Shipping' },
              { icon: Zap, label: 'Lab Tested' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2 text-center">
                <item.icon className="w-5 h-5 text-brand-400" />
                <span className="text-xs text-white/40">{item.label}</span>
              </div>
            ))}
          </div>

          {/* RUO Disclaimer */}
          <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
            <p className="text-[11px] text-white/30 leading-relaxed">
              <strong className="text-white/40">For Research Use Only.</strong> Not for human consumption. Not intended to diagnose, treat, cure, or prevent any disease. Not evaluated by the FDA. By purchasing you confirm these are for legitimate research purposes.
            </p>
          </div>
        </div>
      </div>

      {/* Full description / "Product Details" section removed per owner request
          2026-06-08. Data is preserved in Product.description (still used for SEO
          meta + card fallbacks); restore by re-adding the block here. */}

      {/* Pair-with anti-inflammatory recommendation (BPC-157 + TB-500) */}
      <PairWithAntiInflammatory
        currentSlug={product.slug}
        currentCategorySlug={product.category?.slug}
      />

      {/* Reviews */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold">
            Reviews ({product.reviews.length})
          </h2>
          {canReview && !alreadyReviewed && (
            <Link
              href={`/products/${product.slug}/review`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 transition-colors text-sm font-medium"
            >
              <Edit3 className="w-4 h-4" /> Write a Review
            </Link>
          )}
          {canReview && alreadyReviewed && (
            <span className="text-white/40 text-sm">
              You reviewed this product.
            </span>
          )}
        </div>
        {product.reviews.length > 0 ? (
          <div className="space-y-4">
            {product.reviews.map((review) => (
              <div key={review.id} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < review.rating
                            ? 'text-amber-400'
                            : 'text-white/20'
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="font-semibold text-sm">
                    {review.user.name ?? 'Anonymous'}
                  </span>
                </div>
                {review.title && (
                  <h4 className="font-medium mb-1">{review.title}</h4>
                )}
                {review.body && (
                  <p className="text-white/60 text-sm">{review.body}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl p-8 text-center text-white/40 text-sm">
            No reviews yet.
          </div>
        )}
      </div>

      {/* You May Also Like */}
      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {related.map((p) => {
              const img = p.images?.[0]
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="group glass rounded-2xl overflow-hidden card-hover"
                >
                  <div className="relative aspect-square bg-dark-800">
                    {img ? (
                      <Image
                        src={img.url}
                        alt={img.alt ?? p.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10">
                        <span className="text-3xl font-bold">VP</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    {p.category && (
                      <p className="text-[10px] text-brand-400 uppercase tracking-wider mb-1">
                        {p.category.name}
                      </p>
                    )}
                    <h3 className="font-semibold text-white text-sm mb-1 line-clamp-2">{p.name}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-white">{formatPrice(p.price)}</span>
                      {p.comparePrice && (
                        <span className="text-xs text-white/40 line-through">
                          {formatPrice(p.comparePrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
