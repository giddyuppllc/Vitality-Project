export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag } from 'lucide-react'
import { notFound } from 'next/navigation'

export default async function PathBasedKioskPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  })
  if (!org || org.status !== 'ACTIVE') notFound()

  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    orderBy: [{ featured: 'desc' }, { name: 'asc' }],
  })

  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Welcome to {org.name}</h2>
        <p className="text-white/50">Tap a product to learn more and add to your order</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {products.map((product) => {
          const image = product.images[0]?.url
          const displayPrice = product.salePrice ?? product.price
          return (
            <Link
              key={product.id}
              href={`/shop/${product.slug}?via=k:${slug}`}
              className="glass rounded-2xl overflow-hidden hover:ring-2 hover:ring-brand-500/40 transition-all"
            >
              <div className="aspect-square bg-dark-800 relative">
                {image ? (
                  <Image
                    src={image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ShoppingBag className="w-10 h-10 text-white/20" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-white mb-1 line-clamp-1">{product.name}</h3>
                <p className="text-brand-400 font-bold text-lg">{formatPrice(displayPrice)}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
