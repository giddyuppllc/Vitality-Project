import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  MousePointerClick,
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle,
  Copy,
} from 'lucide-react'
import { AffiliateCopyLink } from './copy-link'
import { RequestPayoutButton } from './request-payout-button'

const commissionStatusVariant: Record<
  string,
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
  PENDING: 'warning',
  APPROVED: 'info',
  PAID: 'success',
  CANCELLED: 'danger',
}

export default async function AffiliatePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
  })

  // No affiliate record — show CTA
  if (!affiliate) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Affiliate Program</h1>
        <div className="glass rounded-2xl p-10 text-center">
          <Users className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Earn with Referrals</h2>
          <p className="text-white/40 mb-6 max-w-md mx-auto">
            Join our affiliate program and earn commissions on every sale you refer.
            Share your unique link and start earning today.
          </p>
          <Link
            href="/affiliate"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-all shadow-lg shadow-brand-500/25"
          >
            Apply to Become an Affiliate
          </Link>
        </div>
      </div>
    )
  }

  // PENDING status
  if (affiliate.status === 'PENDING') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Affiliate Program</h1>
        <div className="glass rounded-2xl p-10 text-center">
          <Clock className="w-16 h-16 text-amber-400/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Application Under Review</h2>
          <Badge variant="warning" className="mb-4">
            PENDING
          </Badge>
          <p className="text-white/40 max-w-md mx-auto">
            Your affiliate application is being reviewed. We will notify you once it has
            been approved. This usually takes 1-2 business days.
          </p>
        </div>
      </div>
    )
  }

  // SUSPENDED
  if (affiliate.status === 'SUSPENDED') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Affiliate Program</h1>
        <div className="glass rounded-2xl p-10 text-center">
          <Users className="w-16 h-16 text-red-400/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Account Suspended</h2>
          <Badge variant="danger" className="mb-4">
            SUSPENDED
          </Badge>
          <p className="text-white/40 max-w-md mx-auto">
            Your affiliate account has been suspended. Please contact support for more
            information.
          </p>
        </div>
      </div>
    )
  }

  // ACTIVE — full dashboard
  const [totalClicks, recentClicks, recentCommissions, payouts, commissionAgg] =
    await Promise.all([
      prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
      prisma.affiliateClick.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.affiliateCommission.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.affiliatePayout.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.affiliateCommission.groupBy({
        by: ['status'],
        where: { affiliateId: affiliate.id },
        _count: true,
        _sum: { amount: true },
      }),
    ])

  const pendingEarnings =
    commissionAgg.find((c) => c.status === 'PENDING')?._sum.amount ?? 0
  const approvedEarnings =
    commissionAgg.find((c) => c.status === 'APPROVED')?._sum.amount ?? 0
  const paidEarnings =
    commissionAgg.find((c) => c.status === 'PAID')?._sum.amount ?? 0
  const totalOrders = commissionAgg.reduce((sum, c) => sum + (c._count ?? 0), 0)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'
  const referralLink = `${appUrl}/ref/${affiliate.code}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Affiliate Dashboard</h1>
        <Badge variant="success">ACTIVE</Badge>
      </div>

      {/* Referral link */}
      <div className="glass rounded-2xl p-5 mb-6">
        <p className="text-sm text-white/50 mb-2">Your Referral Link</p>
        <AffiliateCopyLink link={referralLink} />
        <p className="text-xs text-white/30 mt-2">
          Commission rate: {(affiliate.commissionRate * 100).toFixed(0)}% per sale
        </p>
      </div>

      {/* Payout request */}
      <div className="glass rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Approved balance</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{formatPrice(approvedEarnings)}</p>
            <p className="text-xs text-white/30 mt-1">
              {pendingEarnings > 0
                ? `${formatPrice(pendingEarnings)} still pending admin review`
                : 'All your commissions are approved or paid'}
            </p>
          </div>
          <RequestPayoutButton approvedBalanceCents={approvedEarnings} />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <MousePointerClick className="w-4 h-4 text-brand-400" />
            <span className="text-xs text-white/50">Total Clicks</span>
          </div>
          <p className="text-2xl font-bold">{totalClicks}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4 text-brand-400" />
            <span className="text-xs text-white/50">Total Orders</span>
          </div>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-white/50">Pending Earnings</span>
          </div>
          <p className="text-2xl font-bold">{formatPrice(pendingEarnings)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-white/50">Paid Earnings</span>
          </div>
          <p className="text-2xl font-bold">{formatPrice(paidEarnings)}</p>
        </div>
      </div>

      {/* Recent Clicks */}
      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Recent Referral Clicks</h2>
        {recentClicks.length === 0 ? (
          <p className="text-sm text-white/40">No clicks yet. Share your referral link to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Referrer</th>
                  <th className="pb-2">Converted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentClicks.map((click) => (
                  <tr key={click.id}>
                    <td className="py-2 pr-4 text-white/60">
                      {formatDate(click.createdAt)}
                    </td>
                    <td className="py-2 pr-4 text-white/60 max-w-[200px] truncate">
                      {click.referrer ?? 'Direct'}
                    </td>
                    <td className="py-2">
                      <Badge variant={click.converted ? 'success' : 'default'}>
                        {click.converted ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Commissions */}
      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Recent Commissions</h2>
        {recentCommissions.length === 0 ? (
          <p className="text-sm text-white/40">No commissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Order ID</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentCommissions.map((comm) => (
                  <tr key={comm.id}>
                    <td className="py-2 pr-4 text-white/60">
                      {formatDate(comm.createdAt)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-white/50">
                      {comm.orderId.slice(0, 12)}...
                    </td>
                    <td className="py-2 pr-4 font-bold">
                      {formatPrice(comm.amount)}
                    </td>
                    <td className="py-2">
                      <Badge variant={commissionStatusVariant[comm.status] ?? 'default'}>
                        {comm.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout History */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Payout History</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-white/40">No payouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="py-2 pr-4 text-white/60">
                      {formatDate(payout.createdAt)}
                    </td>
                    <td className="py-2 pr-4 font-bold">
                      {formatPrice(payout.amount)}
                    </td>
                    <td className="py-2 pr-4 text-white/60 capitalize">
                      {payout.method}
                    </td>
                    <td className="py-2 text-white/40 font-mono text-xs">
                      {payout.reference ?? '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
