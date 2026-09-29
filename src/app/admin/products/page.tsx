import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ProductsTable } from '@/components/admin/products-table'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: {
      category: { select: { name: true } },
      images: { take: 1, orderBy: { position: 'asc' } },
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-white/40 mt-1">{products.length} total</p>
        </div>
        <Link href="/admin/products/new">
          <Button>
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </Link>
      </div>

      <ProductsTable products={products} />
    </div>
  )
}
