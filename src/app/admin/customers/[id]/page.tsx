export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { TIER_BENEFITS, planIdToTier } from '@/lib/membership'
import { Badge } from '@/components/ui/badge'
import { CustomerHeader } from '@/components/admin/customer-profile/customer-header'
import {
  CustomerTabs,
  parseTab,
} from '@/components/admin/customer-profile/customer-tabs'
import { CustomerTagsPanel } from '@/components/admin/customer-profile/customer-tags-panel'
import { CustomerNotesPanel } from '@/components/admin/customer-profile/customer-notes-panel'
import { CustomerActivityTimeline } from '@/components/admin/customer-profile/customer-activity-timeline'
import { SendMessageModal } from '@/components/admin/customer-profile/send-message-modal'
import { CustomerCommPrefs } from '@/components/admin/customer-profile/customer-comm-prefs'
import { CustomerQuickActions } from '@/components/admin/customer-profile/customer-quick-actions'
import {
  ShoppingBag,
  MessageSquare,
  CheckSquare,
  Ticket,
  Truck,
  Sparkles,
  DollarSign,
  Star,
  Mail,
  Building2,
  ArrowLeft,
  CreditCard,
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminCustomerProfilePage({
  params,
  searchParams,
}: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/auth/login')
  }

  const { id } = await params
  const sp = await searchParams
  const activeTab = parseTab(sp.tab)

  const [
    user,
    orders,
    addresses,
    reviews,
    loyaltyTxns,
    storeCreditTxns,
    tickets,
    notes,
    userTagsRows,
    allTags,
    outbound,
    commPref,
    activeTasks,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        affiliate: {
          include: {
            _count: { select: { commissions: true } },
          },
        },
        loyalty: true,
        storeCredit: true,
        membership: true,
        orgMemberships: {
          include: { organization: true, location: true },
        },
        orgClients: {
          include: { organization: true, location: true },
        },
      },
    }),
    prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { items: true } },
      },
    }),
    prisma.address.findMany({
      where: { userId: id },
      orderBy: { isDefault: 'desc' },
    }),
    prisma.review.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true, slug: true } } },
    }),
    prisma.loyaltyTransaction.findMany({
      where: { account: { userId: id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.storeCreditTxn.findMany({
      where: { credit: { userId: id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.supportTicket.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customerNote.findMany({
      where: { userId: id },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.userTag.findMany({
      where: { userId: id },
      include: { tag: true },
    }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    prisma.outboundMessage.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.communicationPreference.findUnique({ where: { userId: id } }),
    prisma.adminTask.findMany({
      where: {
        entityType: 'User',
        entityId: id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      orderBy: { dueAt: 'asc' },
    }),
  ])

  if (!user) notFound()

  // Lightweight "interest" signup (email lead) — distinct from a real
  // Membership row. Lets the admin tell "requested a tier / left an email" from
  // "is an actual (or pending) paying member". Keyed by email.
  const interestSignup = await prisma.membershipSignup.findUnique({
    where: { email: user.email },
  })

  const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID')
  const ltv = paidOrders.reduce((sum, o) => sum + o.total, 0)

  const assignedTags = userTagsRows.map((r) => r.tag)

  const activeTickets = tickets.filter(
    (t) => t.status !== 'CLOSED' && t.status !== 'RESOLVED',
  )

  const prefs = commPref ?? {
    userId: id,
    transactionalEmail: true,
    marketingEmail: true,
    sms: false,
    phoneContact: true,
  }

  const commDisabled =
    !prefs.transactionalEmail && !prefs.marketingEmail

  return (
    <div>
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All customers
      </Link>

      <CustomerHeader
        user={user}
        ltv={ltv}
        orderCount={paidOrders.length}
        tier={user.loyalty?.tier ?? null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <CustomerTabs userId={id} active={activeTab} />

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <SummaryTile
                  icon={<Sparkles className="w-4 h-4 text-brand-400" />}
                  label="Points balance"
                  value={(user.loyalty?.points ?? 0).toLocaleString()}
                />
                <SummaryTile
                  icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                  label="Store credit"
                  value={formatPrice(user.storeCredit?.balance ?? 0)}
                />
                <SummaryTile
                  icon={<Star className="w-4 h-4 text-amber-400" />}
                  label="Reviews"
                  value={reviews.length.toString()}
                />
              </div>

              {/* Membership — real (paying / pending) status + any email-interest
                  signup, so admin can tell a paying member from a mere lead. */}
              {(user.membership && user.membership.tier !== 'NONE') ||
              interestSignup ? (
                <div className="glass rounded-2xl p-6">
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
                    <CreditCard className="w-4 h-4 text-brand-400" /> Membership
                  </h3>
                  {user.membership && user.membership.tier !== 'NONE' ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">Tier</span>
                        <Badge variant="info">
                          {membershipTierLabel(user.membership.tier)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">Status</span>
                        <Badge
                          variant={
                            membershipStatusBadge(user.membership.status).variant
                          }
                        >
                          {membershipStatusBadge(user.membership.status).label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">Monthly</span>
                        <span className="text-white/70">
                          {formatPrice(user.membership.monthlyPriceCents)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">Signed up</span>
                        <span className="text-white/50 text-xs">
                          {formatDate(user.membership.startedAt)}
                        </span>
                      </div>
                      {user.membership.paymentConfirmedAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-white/50">First paid</span>
                          <span className="text-white/50 text-xs">
                            {formatDate(user.membership.paymentConfirmedAt)}
                          </span>
                        </div>
                      )}
                      {user.membership.status === 'PENDING_PAYMENT' &&
                        user.membership.pendingInvoiceOrderId && (
                          <div className="pt-1">
                            <Link
                              href={`/admin/orders/${user.membership.pendingInvoiceOrderId}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
                            >
                              Review unpaid invoice →
                            </Link>
                          </div>
                        )}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">
                      No active membership.
                    </p>
                  )}

                  {interestSignup && (
                    <div className="mt-4 pt-4 border-t border-white/5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 flex items-center gap-2">
                          Requested tier
                          <Badge variant="warning">Interest only</Badge>
                        </span>
                        <span className="text-white/70">
                          {membershipTierLabel(
                            planIdToTier(interestSignup.plan),
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/30 mt-1">
                        Email lead via {interestSignup.source ?? 'site'} ·{' '}
                        {formatDate(interestSignup.createdAt)} · not yet a paying
                        member
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-brand-400" /> Recent
                    orders
                  </h3>
                  {orders.length > 5 && (
                    <Link
                      href={`/admin/customers/${id}?tab=orders`}
                      className="text-xs text-brand-400 hover:text-brand-300"
                    >
                      View all ({orders.length}) →
                    </Link>
                  )}
                </div>
                {orders.length === 0 ? (
                  <p className="text-sm text-white/30">No orders yet.</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {orders.slice(0, 5).map((o) => (
                      <div
                        key={o.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="text-sm font-medium hover:text-brand-400 transition-colors"
                          >
                            {o.orderNumber}
                          </Link>
                          <p className="text-xs text-white/40">
                            {formatDate(o.createdAt)} ·{' '}
                            {o._count.items}{' '}
                            {o._count.items === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={o.status} />
                          <span className="text-sm font-bold">
                            {formatPrice(o.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Ticket className="w-4 h-4 text-emerald-400" /> Active
                    tickets
                  </h3>
                  {activeTickets.length === 0 ? (
                    <p className="text-xs text-white/30">None open.</p>
                  ) : (
                    <div className="space-y-2">
                      {activeTickets.slice(0, 4).map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 py-1"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {t.subject}
                            </p>
                            <p className="text-[10px] text-white/40">
                              {t.number}
                            </p>
                          </div>
                          <Badge variant="warning">{t.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <CheckSquare className="w-4 h-4 text-purple-400" /> Open
                    tasks
                  </h3>
                  {activeTasks.length === 0 ? (
                    <p className="text-xs text-white/30">
                      No tasks for this customer.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeTasks.slice(0, 4).map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 py-1"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {t.title}
                            </p>
                            <p className="text-[10px] text-white/40">
                              {t.dueAt
                                ? `Due ${formatDate(t.dueAt)}`
                                : 'No due date'}
                            </p>
                          </div>
                          <Badge
                            variant={
                              t.priority === 'URGENT' || t.priority === 'HIGH'
                                ? 'danger'
                                : 'info'
                            }
                          >
                            {t.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(user.affiliate ||
                user.orgMemberships.length > 0 ||
                user.orgClients.length > 0) && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-sky-400" /> Relationships
                  </h3>
                  <div className="space-y-2 text-sm">
                    {user.affiliate && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Affiliate code</span>
                        <span className="font-mono text-brand-400">
                          {user.affiliate.code}{' '}
                          <span className="text-white/40">
                            · {formatPrice(user.affiliate.totalEarned)} earned
                          </span>
                        </span>
                      </div>
                    )}
                    {user.orgMemberships.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-white/60">
                          Member of {m.organization.name}
                        </span>
                        <Badge variant="info">{m.role}</Badge>
                      </div>
                    ))}
                    {user.orgClients.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-white/60">
                          Client of {c.organization.name}
                        </span>
                        <Badge
                          variant={
                            c.status === 'ACTIVE' ? 'success' : 'default'
                          }
                        >
                          {c.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Tracking
                    </th>
                    <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-white/30 text-sm"
                      >
                        No orders yet.
                      </td>
                    </tr>
                  )}
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-white/2">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-sm font-medium hover:text-brand-400 transition-colors"
                        >
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            o.paymentStatus === 'PAID'
                              ? 'success'
                              : o.paymentStatus === 'REFUNDED' ||
                                  o.paymentStatus === 'PARTIALLY_REFUNDED'
                                ? 'warning'
                                : o.paymentStatus === 'FAILED'
                                  ? 'danger'
                                  : 'default'
                          }
                        >
                          {o.paymentStatus}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-white/60">
                        {o._count.items}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium">
                        {formatPrice(o.total)}
                      </td>
                      <td className="px-5 py-3 text-sm text-white/50">
                        {o.trackingNumber ? (
                          o.trackingUrl ? (
                            <a
                              href={o.trackingUrl}
                              target="_blank"
                              rel="noopener"
                              className="hover:text-brand-400 inline-flex items-center gap-1"
                            >
                              <Truck className="w-3 h-3" />{' '}
                              {o.trackingNumber.slice(0, 10)}…
                            </a>
                          ) : (
                            <span className="font-mono text-xs">
                              {o.trackingNumber.slice(0, 12)}…
                            </span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/40">
                        {formatDate(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'communication' && (
            <div className="space-y-6">
              <CustomerCommPrefs
                userId={id}
                initial={{
                  transactionalEmail: prefs.transactionalEmail,
                  marketingEmail: prefs.marketingEmail,
                  sms: prefs.sms,
                  phoneContact: prefs.phoneContact,
                }}
              />
              <div className="glass rounded-2xl p-5">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-400" /> Send a message
                </h3>
                <SendMessageModal
                  userId={id}
                  userEmail={user.email}
                  disabledEmail={commDisabled}
                />
              </div>
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Message history</h3>
                  <span className="text-xs text-white/40">
                    {outbound.length} total
                  </span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5 text-left">
                      <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                        Channel
                      </th>
                      <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                        From
                      </th>
                      <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                        Sent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {outbound.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-10 text-center text-white/30 text-sm"
                        >
                          No messages sent yet.
                        </td>
                      </tr>
                    )}
                    {outbound.map((m) => (
                      <tr key={m.id} className="hover:bg-white/2">
                        <td className="px-5 py-3">
                          <Badge
                            variant={
                              m.channel === 'EMAIL' ? 'info' : 'default'
                            }
                          >
                            {m.channel}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {m.subject ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-white/50">
                          {m.sentByName ?? 'System'}
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            variant={
                              m.status === 'SENT' ||
                              m.status === 'DELIVERED' ||
                              m.status === 'OPENED' ||
                              m.status === 'CLICKED'
                                ? 'success'
                                : m.status === 'BOUNCED' ||
                                    m.status === 'FAILED'
                                  ? 'danger'
                                  : 'default'
                            }
                          >
                            {m.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-xs text-white/40">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <CustomerNotesPanel
              userId={id}
              notes={notes.map((n) => ({
                id: n.id,
                body: n.body,
                authorName: n.authorName,
                pinned: n.pinned,
                createdAt: n.createdAt,
              }))}
            />
          )}

          {activeTab === 'activity' && (
            <CustomerActivityTimeline userId={id} userEmail={user.email} />
          )}
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4">
          <CustomerTagsPanel
            userId={id}
            assignedTags={assignedTags.map((t) => ({
              id: t.id,
              name: t.name,
              color: t.color,
            }))}
            allTags={allTags.map((t) => ({
              id: t.id,
              name: t.name,
              color: t.color,
            }))}
          />
          <CustomerQuickActions userId={id} userEmail={user.email} />

          {addresses.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-3">Addresses</h3>
              <div className="space-y-3">
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    className="text-xs text-white/60 leading-relaxed"
                  >
                    <p className="font-medium text-white/80">
                      {a.name}
                      {a.isDefault && (
                        <span className="ml-2 text-[10px] text-emerald-400">
                          DEFAULT
                        </span>
                      )}
                    </p>
                    <p>{a.line1}</p>
                    {a.line2 && <p>{a.line2}</p>}
                    <p>
                      {a.city}, {a.state} {a.zip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(loyaltyTxns.length > 0 || storeCreditTxns.length > 0) && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-3">Credit & points</h3>
              <div className="space-y-1.5">
                {storeCreditTxns.slice(0, 4).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-white/50 truncate">
                      {tx.description}
                    </span>
                    <span
                      className={
                        tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {formatPrice(tx.amount)}
                    </span>
                  </div>
                ))}
                {loyaltyTxns.slice(0, 4).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-white/50 truncate">
                      {tx.description}
                    </span>
                    <span
                      className={
                        tx.points > 0 ? 'text-brand-400' : 'text-white/40'
                      }
                    >
                      {tx.points > 0 ? '+' : ''}
                      {tx.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}

function membershipTierLabel(tier: string): string {
  return (
    (TIER_BENEFITS as Record<string, { label: string }>)[tier]?.label ?? tier
  )
}

function membershipStatusBadge(status: string): {
  variant: 'success' | 'warning' | 'danger' | 'default'
  label: string
} {
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

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'DELIVERED'
      ? 'success'
      : status === 'SHIPPED'
        ? 'info'
        : status === 'CANCELLED' || status === 'REFUNDED'
          ? 'danger'
          : 'warning'
  return <Badge variant={variant}>{status}</Badge>
}
