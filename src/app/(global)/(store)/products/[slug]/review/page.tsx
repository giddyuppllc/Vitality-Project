import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ReviewForm } from '@/components/store/review-form'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id)
    redirect(`/auth/login?callbackUrl=/products/${slug}/review`)

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  })
  if (!product) notFound()

  // Verify purchased
  const purchase = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: {
        userId: session.user.id,
        paymentStatus: 'PAID',
      },
    },
    select: { id: true },
  })

  if (!purchase) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold mb-3">Purchase required</h1>
          <p className="text-white/50">
            Only verified customers can review this product.
          </p>
        </div>
      </div>
    )
  }

  const existing = await prisma.review.findFirst({
    where: { productId: product.id, userId: session.user.id },
    select: { id: true },
  })

  if (existing) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold mb-3">Already reviewed</h1>
          <p className="text-white/50">
            You have already submitted a review for {product.name}. Thanks!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Review {product.name}</h1>
        <p className="text-white/50 text-sm">
          Your review helps other researchers make informed decisions.
        </p>
      </div>
      <ReviewForm productId={product.id} productSlug={product.slug} />
    </div>
  )
}
