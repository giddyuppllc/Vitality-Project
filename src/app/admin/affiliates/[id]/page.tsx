import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, MousePointer, DollarSign, Tag } from 'lucide-react'
import { LinkGenerator } from './link-generator'
import { AffiliateStatusActions } from './status-actions'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

export default async function AffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const aff = await prisma.affiliate.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, createdAt: true } },
      links: { orderBy: { createdAt: 'desc' } },
      commissions: {
        select: { amount: true, status: true, createdAt: true, orderId: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      payouts: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { clicks: true, commissions: true } },
    },
  })
  if (!aff) notFound()

  const earned = aff.commissions
    .filter((c) => c.status !== 'CANCELLED')
    .reduce((s, c) => s + c.amount, 0)
  const owed = aff.commissions
    .filter((c) => c.status === 'APPROVED')
    .reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-6">
      <Link
        href="/admin/affiliates"
        className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> All affiliates
      </Link>

      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{aff.user.name ?? aff.user.email}</h1>
            <p className="text-sm text-white/50 mt-0.5">{aff.user.email}</p>
            <p className="text-xs text-white/40 mt-2">
              Joined {formatDate(aff.user.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-1">Code</p>
            <code className="bg-dark-700 px-3 py-1.5 rounded text-brand-400 font-mono">
              {aff.code}
            </code>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-white/10">
          <AffiliateStatusActions
            id={aff.id}
            status={aff.status}
            commissionRate={aff.commissionRate}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <Stat icon={<MousePointer className="w-4 h-4 text-purple-400" />} label="Clicks" value={String(aff._count.clicks)} />
          <Stat icon={<Tag className="w-4 h-4 text-blue-400" />} label="Commissions" value={String(aff._count.commissions)} />
          <Stat icon={<DollarSign className="w-4 h-4 text-emerald-400" />} label="Earned" value={formatPrice(earned)} />
          <Stat
            icon={<DollarSign className="w-4 h-4 text-amber-400" />}
            label="Owed"
            value={owed > 0 ? formatPrice(owed) : '—'}
          />
        </div>
      </div>

      {/* Trackable Links */}
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Trackable Links</h2>
        </div>
        <LinkGenerator affiliateId={aff.id} affiliateCode={aff.code} appUrl={APP_URL} />

        {aff.links.length === 0 ? (
          <p className="text-sm text-white/30 mt-6">
            No trackable links yet. Generate one above and share with the affiliate.
          </p>
        ) : (
          <div className="mt-6 space-y-2">
            {aff.links.map((l) => {
              const trackable = `${APP_URL}/r/${aff.code}/${l.slug}`
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-4 p-3 bg-dark-700 rounded-xl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{l.name}</p>
                    <p className="text-xs text-white/40 truncate">→ {l.url}</p>
                    <code className="text-xs text-brand-400 break-all">{trackable}</code>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-white/40">Clicks</p>
                    <p className="text-sm font-semibold text-white">{l.clicks}</p>
                  </div>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/40 hover:text-white p-1"
                    aria-label="Open destination"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent Commissions */}
      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Recent Commissions</h2>
        {aff.commissions.length === 0 ? (
          <p className="text-sm text-white/30">No commissions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/40 uppercase tracking-wider">
                <th className="pb-2">Order</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aff.commissions.map((c, i) => (
                <tr key={i}>
                  <td className="py-2 text-white/70 font-mono text-xs">{c.orderId.slice(0, 8)}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === 'PAID' ? 'bg-emerald-500/15 text-emerald-400' :
                      c.status === 'APPROVED' ? 'bg-amber-500/15 text-amber-400' :
                      c.status === 'CANCELLED' ? 'bg-red-500/15 text-red-400' :
                      'bg-blue-500/15 text-blue-400'
                    }`}>{c.status}</span>
                  </td>
                  <td className="py-2 text-right font-semibold">{formatPrice(c.amount)}</td>
                  <td className="py-2 text-right text-white/40 text-xs">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Payouts */}
      {aff.payouts.length > 0 && (
        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Payout History</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/40 uppercase tracking-wider">
                <th className="pb-2">Date</th>
                <th className="pb-2">Method</th>
                <th className="pb-2">Reference</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aff.payouts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-white/70 text-xs">{formatDate(p.createdAt)}</td>
                  <td className="py-2 text-white/70 text-xs uppercase">{p.method}</td>
                  <td className="py-2 text-white/40 text-xs font-mono">{p.reference ?? '—'}</td>
                  <td className="py-2 text-right font-semibold">{formatPrice(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-dark-700 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}
