import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import { CouponForm } from '@/components/admin/coupon-form'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditDiscountPage({ params }: Props) {
  const { id } = await params
  const code = await prisma.discountCode.findUnique({ where: { id } })
  if (!code) notFound()

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
          <h1 className="text-2xl font-bold">Edit Coupon</h1>
          <p className="text-white/40 text-sm mt-0.5 font-mono">{code.code}</p>
        </div>
      </div>
      <CouponForm
        mode="edit"
        id={id}
        products={products}
        categories={categories}
      />
    </div>
  )
}
