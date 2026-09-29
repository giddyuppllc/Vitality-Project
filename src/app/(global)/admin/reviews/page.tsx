import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ReviewModerationRow } from '@/components/admin/review-moderation-row'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminReviewsPage({ searchParams }: Props) {
  const { status = 'pending' } = await searchParams

  const where =
    status === 'approved'
      ? { approved: true }
      : status === 'all'
      ? {}
      : { approved: false }

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true, slug: true } },
    },
    take: 200,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-white/40 mt-1">{reviews.length} {status}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'all'] as const).map((s) => (
          <a
            key={s}
            href={`/admin/reviews?status=${s}`}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              status === s
                ? 'bg-brand-500/20 text-brand-400'
                : 'bg-dark-700 text-white/50 hover:text-white'
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {['Product', 'Customer', 'Rating', 'Review', 'Status', 'Date', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reviews.map((r) => (
              <tr key={r.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4 text-sm font-medium">
                  {r.product.name}
                </td>
                <td className="px-5 py-4 text-sm">
                  <p>{r.user.name ?? 'Anonymous'}</p>
                  <p className="text-xs text-white/40">{r.user.email}</p>
                </td>
                <td className="px-5 py-4 text-amber-400">
                  {'★'.repeat(r.rating)}
                  <span className="text-white/20">
                    {'★'.repeat(5 - r.rating)}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm max-w-md">
                  {r.title && <p className="font-medium">{r.title}</p>}
                  {r.body && (
                    <p className="text-white/50 text-xs line-clamp-2">
                      {r.body}
                    </p>
                  )}
                </td>
                <td className="px-5 py-4">
                  <Badge variant={r.approved ? 'success' : 'warning'}>
                    {r.approved ? 'Approved' : 'Pending'}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-xs text-white/40">
                  {formatDate(r.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <ReviewModerationRow id={r.id} approved={r.approved} />
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-16 text-center text-white/30 text-sm"
                >
                  No reviews in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
