import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Download, Clock } from 'lucide-react'
import { MarkPaidButton } from './mark-paid-button'
import { AffiliateRowActions } from './affiliate-row-actions'
import { AddAffiliateForm } from './add-affiliate-form'

export default async function AdminAffiliatesPage() {
  const affiliates = await prisma.affiliate.findMany({
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { clicks: true, commissions: true } },
      commissions: { select: { amount: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const pending = affiliates.filter((a) => a.status === 'PENDING')
  const active = affiliates.filter((a) => a.status !== 'PENDING')
  const totalPendingPayout = affiliates.reduce(
    (sum, a) =>
      sum +
      a.commissions
        .filter((c) => c.status === 'APPROVED')
        .reduce((s, c) => s + c.amount, 0),
    0,
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Affiliates</h1>
          <p className="text-white/40 mt-1">
            {affiliates.length} total · {pending.length} pending · {formatPrice(totalPendingPayout)} approved-unpaid
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/affiliates/commissions"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
          >
            Commissions →
          </a>
          <a
            href="/api/admin/affiliates/commissions/export"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <AddAffiliateForm />
        <div className="rounded-xl bg-dark-700 border border-white/10 p-4">
          <p className="text-sm font-medium mb-1">Invite an affiliate</p>
          <p className="text-xs text-white/40 mb-3">
            Send this link — they sign up, apply, and appear here as pending for your approval.
          </p>
          <code className="block px-3 py-2 rounded-lg bg-dark-800 border border-white/10 text-xs text-brand-400 break-all">
            https://vitalityproject.global/affiliate
          </code>
        </div>
      </div>

      {/* Pending applications queue — split out so they're impossible to miss */}
      {pending.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
              Pending applications — {pending.length}
            </h2>
          </div>
          <div className="glass rounded-2xl overflow-hidden border border-amber-500/20">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Applicant</th>
                  <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Code</th>
                  <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Applied</th>
                  <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pending.map((aff) => (
                  <tr key={aff.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3">
                      <a href={`/admin/affiliates/${aff.id}`} className="block hover:opacity-80">
                        <p className="text-sm font-medium">{aff.user.name}</p>
                        <p className="text-xs text-white/40">{aff.user.email}</p>
                      </a>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs bg-dark-700 px-2 py-1 rounded text-brand-400">{aff.code}</code>
                    </td>
                    <td className="px-5 py-3 text-sm text-white/50">{formatDate(aff.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <AffiliateRowActions id={aff.id} status={aff.status} />
                        <a href={`/admin/affiliates/${aff.id}`} className="text-xs text-white/40 hover:text-white/70">
                          Review →
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
          Active & suspended — {active.length}
        </h2>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Affiliate</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Code</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Clicks</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Earned</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Owed</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Paid</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {active.map((aff) => {
              const earned = aff.commissions.filter(c => c.status !== 'CANCELLED').reduce((s, c) => s + c.amount, 0)
              // "Owed" = what's been approved but not yet paid out.
              const owed = aff.commissions
                .filter(c => c.status === 'APPROVED')
                .reduce((s, c) => s + c.amount, 0)
              return (
                <tr key={aff.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4">
                    <a
                      href={`/admin/affiliates/${aff.id}`}
                      className="block hover:opacity-80 transition-opacity"
                    >
                      <p className="text-sm font-medium">{aff.user.name}</p>
                      <p className="text-xs text-white/40">{aff.user.email}</p>
                    </a>
                  </td>
                  <td className="px-5 py-4">
                    <code className="text-xs bg-dark-700 px-2 py-1 rounded text-brand-400">{aff.code}</code>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={aff.status === 'ACTIVE' ? 'success' : aff.status === 'PENDING' ? 'warning' : 'danger'}>
                      {aff.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">{aff._count.clicks}</td>
                  <td className="px-5 py-4 text-sm font-medium text-emerald-400">{formatPrice(earned)}</td>
                  <td className="px-5 py-4 text-sm font-medium text-amber-400">
                    {owed > 0 ? formatPrice(owed) : <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">{formatPrice(aff.totalPaid)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {aff.status === 'ACTIVE' && owed > 0 && (
                        <MarkPaidButton affiliateId={aff.id} owedCents={owed} />
                      )}
                      <AffiliateRowActions id={aff.id} status={aff.status} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
