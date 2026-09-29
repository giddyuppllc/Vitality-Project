import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TIER_BENEFITS } from '@/lib/membership'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Prisma, MembershipTier } from '@prisma/client'

export const dynamic = 'force-dynamic'

// The Members admin view. Memberships are billed manually via Zelle: a signup
// creates a PENDING_PAYMENT row + an unpaid invoice Order; an admin marks that
// invoice paid (under Orders) to activate. This page is the single place to see
// who's a member, at which tier, and — crucially — who's awaiting payment, with
// a direct link to the invoice so activating is one click instead of a hunt.

type StatusFilter = 'all' | 'active' | 'pending' | 'cancelled'

const STATUS_GROUPS: Record<Exclude<StatusFilter, 'all'>, string[]> = {
  active: ['ACTIVE'],
  pending: ['PENDING_PAYMENT'],
  cancelled: ['CANCELLED', 'PAUSED'],
}

function parseStatus(raw?: string): StatusFilter {
  return raw === 'active' || raw === 'pending' || raw === 'cancelled' ? raw : 'all'
}

function tierLabel(tier: MembershipTier): string {
  return TIER_BENEFITS[tier]?.label ?? tier
}

function tierVariant(tier: MembershipTier): 'default' | 'info' | 'success' {
  if (tier === 'PREMIUM') return 'info'
  if (tier === 'PLUS') return 'success'
  return 'default'
}

function statusBadge(status: string): { variant: 'success' | 'warning' | 'danger' | 'default'; label: string } {
  switch (status) {
    case 'ACTIVE':
      return { variant: 'success', label: 'Active' }
    case 'PENDING_PAYMENT':
      return { variant: 'warning', label: 'Awaiting payment' }
    case 'CANCELLED':
      return { variant: 'danger', label: 'Cancelled' }
    case 'PAUSED':
      return { variant: 'default', label: 'Paused' }
    default:
      return { variant: 'default', label: status }
  }
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminMembersPage({ searchParams }: Props) {
  const sp = await searchParams
  const status = parseStatus(sp?.status)

  const realMember: Prisma.MembershipWhereInput = { tier: { not: 'NONE' } }
  const where: Prisma.MembershipWhereInput =
    status === 'all' ? realMember : { ...realMember, status: { in: STATUS_GROUPS[status] } }

  const [members, allCount, activeCount, pendingCount, cancelledCount, mrrAgg, signupCount] =
    await Promise.all([
      prisma.membership.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { startedAt: 'desc' },
        take: 500,
      }),
      prisma.membership.count({ where: realMember }),
      prisma.membership.count({ where: { ...realMember, status: 'ACTIVE' } }),
      prisma.membership.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.membership.count({ where: { status: { in: ['CANCELLED', 'PAUSED'] } } }),
      prisma.membership.aggregate({
        _sum: { monthlyPriceCents: true },
        where: { ...realMember, status: 'ACTIVE' },
      }),
      prisma.membershipSignup.count(),
    ])

  const mrrCents = mrrAgg._sum.monthlyPriceCents ?? 0

  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: allCount },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'pending', label: 'Awaiting payment', count: pendingCount },
    { key: 'cancelled', label: 'Cancelled', count: cancelledCount },
  ]

  const stats = [
    { label: 'Active members', value: String(activeCount) },
    { label: 'Monthly revenue', value: money(mrrCents) },
    { label: 'Awaiting payment', value: String(pendingCount), hint: 'need an invoice marked paid' },
    { label: 'Interest sign-ups', value: String(signupCount), hint: 'email leads, not yet members' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-white/40 mt-1">Membership subscriptions, billed monthly via Zelle</p>
      </div>

      {/* At-a-glance stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5">
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider">{s.label}</div>
            <div className="text-2xl font-bold mt-1">{s.value}</div>
            {s.hint ? <div className="text-[11px] text-white/30 mt-1">{s.hint}</div> : null}
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => {
          const active = status === t.key
          const href = t.key === 'all' ? '/admin/members' : `/admin/members?status=${t.key}`
          return (
            <Link
              key={t.key}
              href={href}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                active
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border-white/10'
              }`}
            >
              <span>{t.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-white/10'}`}>
                {t.count}
              </span>
            </Link>
          )
        })}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Member</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Tier</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Monthly</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Signed up</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Activated</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {members.map((m) => {
              const sb = statusBadge(m.status)
              const isPending = m.status === 'PENDING_PAYMENT'
              // For pending members, point straight at the unpaid invoice so the
              // admin can mark it paid (= activate). Otherwise open the customer.
              const actionHref =
                isPending && m.pendingInvoiceOrderId
                  ? `/admin/orders/${m.pendingInvoiceOrderId}`
                  : `/admin/customers/${m.userId}`
              return (
                <tr key={m.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4 text-sm font-medium">
                    <Link href={`/admin/customers/${m.userId}`} className="hover:text-brand-400 transition-colors">
                      {m.user?.name ?? '—'}
                    </Link>
                    <div className="text-xs text-white/40">{m.user?.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={tierVariant(m.tier)}>{tierLabel(m.tier)}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/70">{money(m.monthlyPriceCents)}</td>
                  <td className="px-5 py-4 text-sm text-white/40">{formatDate(m.startedAt)}</td>
                  <td className="px-5 py-4 text-sm text-white/40">
                    {m.paymentConfirmedAt ? formatDate(m.paymentConfirmedAt) : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={actionHref}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isPending
                          ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                          : 'text-white/40 hover:text-brand-400 hover:bg-white/5'
                      }`}
                    >
                      {isPending ? 'Review invoice' : 'Open'}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-white/30 text-sm">
                  No members in this view yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
