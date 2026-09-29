import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/product-card'
import { SearchBar } from '@/components/store/search-bar'
import type { ProductWithImages } from '@/types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const term = q.trim()

  let products: ProductWithImages[] = []
  if (term) {
    const where: any = {
      status: 'ACTIVE',
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { shortDesc: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { tags: { has: term.toLowerCase() } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
      ],
    }
    products = (await prisma.product.findMany({
      where,
      include: {
        images: { orderBy: { position: 'asc' }, take: 1 },
        category: { select: { name: true, slug: true } },
        variants: true,
      },
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
    })) as unknown as ProductWithImages[]
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center">Search</h1>
        <SearchBar variant="full" autoFocus />
      </div>

      {term && (
        <p className="text-white/50 text-sm mb-6">
          {products.length} result{products.length === 1 ? '' : 's'} for &quot;
          {term}&quot;
        </p>
      )}

      {term && products.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          No products match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
