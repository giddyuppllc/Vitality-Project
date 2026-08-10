import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
import { productImage, isFallbackImage } from '@/lib/product-image'

const ANTI_INFLAMMATORY_SLUGS = ['bpc-157-5mg', 'tb-500-5mg']

interface Props {
  currentSlug: string
  currentCategorySlug?: string | null
}

/**
 * Server component. Recommends BPC-157 + TB-500 as anti-inflammatory pairings
 * for any peptide product page. Hides itself when viewing one of the recommended
 * compounds, supplies, or stacks.
 */
export async function PairWithAntiInflammatory({ currentSlug, currentCategorySlug }: Props) {
  // Don't recommend the products to themselves
  if (ANTI_INFLAMMATORY_SLUGS.includes(currentSlug)) return null

  // Don't show for non-peptide categories
  const skipCategories = ['supplies', 'stacks', 'topicals', 'oral']
  if (currentCategorySlug && skipCategories.includes(currentCategorySlug)) return null

  const products = await prisma.product.findMany({
    where: { slug: { in: ANTI_INFLAMMATORY_SLUGS }, status: 'ACTIVE' },
    include: { images: { orderBy: { position: 'asc' }, take: 1 } },
  })

  if (products.length === 0) return null

  return (
    <div className="mt-12 glass rounded-2xl p-6 border border-brand-500/20">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-brand-400" />
        <h3 className="font-semibold text-white">Pairs With This Compound</h3>
      </div>
      <p className="text-sm text-white/50 mb-5 leading-relaxed">
        BPC-157 and TB-500 are studied as major anti-inflammatory and tissue support compounds. Researchers commonly pair them with this product to support recovery and tissue integrity throughout a study protocol.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map((p) => {
          const img = p.images[0]
          return (
            <Link
              key={p.id}
              href={`/products/${p.slug}`}
              className="glass-subtle rounded-xl p-3 flex gap-3 items-center card-hover group"
            >
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-dark-800 shrink-0">
                {/* Was a 'VP' text box without a photo. */}
                <Image
                  src={productImage(p)}
                  alt={p.name}
                  fill
                  className={isFallbackImage(p) ? 'object-contain p-2' : 'object-cover'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm line-clamp-1 group-hover:text-brand-300 transition-colors">{p.name}</p>
                <p className="text-xs text-white/40 line-clamp-1">{p.shortDesc}</p>
                <p className="text-sm font-bold text-brand-300 mt-1">{formatPrice(p.price)}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
