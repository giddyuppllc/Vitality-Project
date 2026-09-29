import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import { CouponForm } from '@/components/admin/coupon-form'

export const dynamic = 'force-dynamic'

export default async function NewDiscountPage() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/discounts"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Coupon</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Create a discount code with advanced rules.
          </p>
        </div>
      </div>
      <CouponForm mode="create" products={products} categories={categories} />
    </div>
  )
}
