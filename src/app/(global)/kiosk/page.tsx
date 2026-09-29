export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getTenantFromRequest } from '@/lib/tenant'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag } from 'lucide-react'

export default async function KioskPage() {
  const { tenantSlug } = await getTenantFromRequest()

  // Resolve org and location pricing if tenant request
  let orgId: string | null = null
  let orgName = 'The Vitality Project'

  if (tenantSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true },
    })
    if (org) {
      orgId = org.id
      orgName = org.name
    }
  }

  // Fetch active products
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: {
      images: { orderBy: { position: 'asc' }, take: 1 },
    },
    orderBy: [{ featured: 'desc' }, { name: 'asc' }],
  })

  return (
    <div className="p-6">
      {/* Welcome section */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Welcome to {orgName}</h2>
        <p className="text-white/50">Tap a product to learn more and add to your order</p>
      </div>

      {/* Product Grid — large touch targets for iPad */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {products.map((product) => {
          const image = product.images[0]?.url
          const displayPrice = product.salePrice ?? product.price

          return (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="glass rounded-2xl overflow-hidden hover:ring-2 hover:ring-brand-500/50 transition-all active:scale-[0.98] group"
            >
              {/* Image */}
              <div className="relative aspect-square bg-dark-700">
                {image ? (
                  <Image
                    src={image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white/20">
                    <ShoppingBag className="w-12 h-12" />
                  </div>
                )}
                {product.salePrice && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    SALE
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-brand-400 transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-brand-400">
                    {formatPrice(displayPrice)}
                  </span>
                  {product.salePrice && (
                    <span className="text-sm text-white/30 line-through">
                      {formatPrice(product.price)}
                    </span>
                  )}
                </div>

                {/* Large touch-friendly Add button */}
                <div className="mt-3 w-full py-3 rounded-xl bg-brand-500 text-center text-sm font-semibold text-white group-hover:bg-brand-600 transition-colors">
                  View Product
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {products.length === 0 && (
        <div className="text-center py-20">
          <ShoppingBag className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">No products available right now.</p>
        </div>
      )}
    </div>
  )
}
