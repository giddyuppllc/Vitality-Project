import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TIER_BENEFITS } from '@/lib/membership'
import {
  Sparkles,
  Calendar,
  Receipt,
  ChevronRight,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { CancelMembershipButton } from './cancel-button'

export const dynamic = 'force-dynamic'

const TIER_LABELS = {
  CLUB: 'The Club',
  PLUS: 'Plus',
  PREMIUM: 'Premium Stacks',
} as const

export default async function AccountMembershipPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const membership = await prisma.membership.findUnique({
    where: { userId: session.user.id },
  })

  // Pull every membership-tagged Order so the customer sees billing history.
  const allOrders = await prisma.order.findMany({
    where: {
      userId: session.user.id,
      notes: { startsWith: 'MEMBERSHIP:' },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      total: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
    },
  })

  if (!membership || membership.tier === 'NONE') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Membership</h1>
        <div className="glass rounded-2xl p-10 text-center">
          <Sparkles className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <h2 className="text-xl font-bold mb-2">No active membership</h2>
          <p className="text-white/40 mb-6 max-w-md mx-auto">
            Join The Vitality Project to unlock permanent discounts, free
            BAC water on Plus / Premium, and free peptides each cycle.
          </p>
          <Link
            href="/membership"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" /> Browse Plans
          </Link>
        </div>

        {allOrders.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-3">
              Past Invoices
            </h2>
            <InvoiceTable orders={allOrders} />
          </div>
        )}
      </div>
    )
  }

  const tierKey = membership.tier as 'CLUB' | 'PLUS' | 'PREMIUM'
  const benefits = TIER_BENEFITS[tierKey]
  const planLabel = TIER_LABELS[tierKey] ?? membership.tier

  const statusTone =
    membership.status === 'ACTIVE'
      ? 'success'
      : membership.status === 'PENDING_PAYMENT'
        ? 'warning'
        : membership.status === 'PAUSED'
          ? 'info'
          : 'danger'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Membership</h1>

      {/* Plan card */}
      <div className="glass rounded-2xl p-6 mb-6 border border-brand-500/20">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <p className="text-xs uppercase tracking-wider text-brand-300 font-semibold">
                Current Plan
              </p>
            </div>
            <h2 className="text-2xl font-bold">{planLabel}</h2>
            <p className="text-sm text-white/50 mt-0.5">
              {formatPrice(benefits.monthlyPriceCents)}/month — billed via Zelle
            </p>
          </div>
          <Badge variant={statusTone}>{membership.status.replace('_', ' ')}</Badge>
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-dark-700/40 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs uppercase tracking-wider text-white/40">Signed up</span>
            </div>
            <p className="text-sm font-medium">{formatDate(membership.startedAt)}</p>
          </div>
          <div className="bg-dark-700/40 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs uppercase tracking-wider text-white/40">First payment</span>
            </div>
            <p className="text-sm font-medium">
              {membership.paymentConfirmedAt
                ? formatDate(membership.paymentConfirmedAt)
                : <span className="text-white/40">Pending</span>}
            </p>
          </div>
          <div className="bg-dark-700/40 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs uppercase tracking-wider text-white/40">Renews</span>
            </div>
            <p className="text-sm font-medium">
              {membership.renewsAt
                ? formatDate(membership.renewsAt)
                : <span className="text-white/40">—</span>}
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-xs">
          <div className="bg-dark-700/40 rounded-xl p-3">
            <p className="text-white/40 mb-0.5">Discount</p>
            <p className="text-base font-bold text-emerald-400">
              {benefits.permanentDiscountPct}%
            </p>
          </div>
          <div className="bg-dark-700/40 rounded-xl p-3">
            <p className="text-white/40 mb-0.5">Free shipping</p>
            <p className="text-base font-bold">{benefits.freeShipping ? 'Yes' : 'No'}</p>
          </div>
          <div className="bg-dark-700/40 rounded-xl p-3">
            <p className="text-white/40 mb-0.5">Free supplies</p>
            <p className="text-base font-bold">{benefits.freeBacAndSyringes ? 'Yes' : 'No'}</p>
          </div>
          <div className="bg-dark-700/40 rounded-xl p-3">
            <p className="text-white/40 mb-0.5">Free peptides/cycle</p>
            <p className="text-base font-bold">{benefits.freePeptideCreditsPerPeriod}</p>
          </div>
        </div>

        {/* This cycle's member credits */}
        {membership.status === 'ACTIVE' &&
          (benefits.freePeptideCreditsPerPeriod > 0 || benefits.freeBacAndSyringes) && (
            <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 mb-4">
              <p className="text-xs uppercase tracking-wider text-brand-300 font-semibold mb-2">
                This cycle&rsquo;s credits
              </p>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
                {benefits.freePeptideCreditsPerPeriod > 0 && (
                  <div>
                    <span className="text-2xl font-bold text-emerald-400">
                      {Math.max(
                        0,
                        membership.freePeptideCreditsThisPeriod - membership.freePeptidesUsedThisPeriod,
                      )}
                    </span>
                    <span className="text-white/50">
                      {' '}
                      / {membership.freePeptideCreditsThisPeriod} free peptide
                      {membership.freePeptideCreditsThisPeriod === 1 ? '' : 's'} left
                    </span>
                  </div>
                )}
                {benefits.freeBacAndSyringes && (
                  <div className="text-white/70">
                    Free BAC + syringes:{' '}
                    <span className="font-semibold text-white">every order</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-white/40 mt-2">
                Add any peptide to your cart — your credit applies free at checkout. Credits
                reset each renewal (use-it-or-lose-it).
              </p>
            </div>
          )}

        {/* Pending invoice CTA */}
        {membership.pendingInvoiceOrderId && membership.status !== 'ACTIVE' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
            <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-amber-200">
                Pending payment — your invoice was emailed.
              </p>
              <p className="text-white/60 mt-1 text-xs">
                Send the Zelle amount with the memo from the invoice. We'll
                activate your membership the moment funds clear.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/membership"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/10 text-sm text-white/70 hover:text-white"
          >
            Change Plan <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          {membership.status === 'ACTIVE' && (
            <CancelMembershipButton membershipId={membership.id} />
          )}
        </div>
      </div>

      {/* Billing history */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-2">
        <Receipt className="w-3.5 h-3.5" /> Billing History
      </h2>
      <InvoiceTable orders={allOrders} />
    </div>
  )
}

function InvoiceTable({
  orders,
}: {
  orders: Array<{
    id: string
    orderNumber: string
    total: number
    paymentStatus: string
    createdAt: Date
  }>
}) {
  if (orders.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-white/40">
        No invoices yet — they'll appear here as you renew.
      </div>
    )
  }
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5 text-left">
            <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Invoice</th>
            <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Date</th>
            <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Amount</th>
            <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="px-5 py-3 text-sm">
                <code className="text-brand-400 text-xs">{o.orderNumber}</code>
              </td>
              <td className="px-5 py-3 text-sm text-white/60">{formatDate(o.createdAt)}</td>
              <td className="px-5 py-3 text-sm font-medium">{formatPrice(o.total)}</td>
              <td className="px-5 py-3">
                <Badge
                  variant={
                    o.paymentStatus === 'PAID'
                      ? 'success'
                      : o.paymentStatus === 'UNPAID'
                        ? 'warning'
                        : 'default'
                  }
                >
                  {o.paymentStatus}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
