import { ExternalLink } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getRewardsSummary } from '@/lib/vip/rewards-view'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { formatPrice } from '@/lib/utils'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Rewards' }

/**
 * Rewards are spent at vitalityproject.global — this page shows the balance
 * and history from the shared StoreCredit ledger and hands off to the store.
 * There is no checkout on the clubhouse.
 */
export default async function RewardsPage() {
  const viewer = await requireVipPage('member')
  const r = await getRewardsSummary(viewer)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Rewards" />

      <section className="vip-surface-strong p-5 sm:p-6" aria-labelledby="bal">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p id="bal" className="text-sm text-white/55">Store credit balance</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">{formatPrice(r.balanceCents)}</p>
            <p className="mt-2 text-sm text-white/55">Store credit at vitalityproject.global.</p>
          </div>
          <a
            href={GLOBAL_LINKS.shop()}
            className="vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Shop at vitalityproject.global <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Membership perks at vitalityproject.global">
        <div className="vip-surface p-4">
          <p className="text-xs text-white/50">Your tier</p>
          <div className="mt-2">
            <TierBadge tier={r.tier} admin={viewer.isAdmin && r.tier === 'NONE'} />
          </div>
        </div>
        <div className="vip-surface p-4">
          <p className="text-xs text-white/50">Member discount at checkout</p>
          <p className="mt-1 text-xl font-bold">{r.storePerks.memberDiscountPct}%</p>
        </div>
        <div className="vip-surface p-4">
          <p className="text-xs text-white/50">Member shipping</p>
          <p className="mt-1 text-xl font-bold">{r.storePerks.freeShipping ? 'Free' : 'Standard'}</p>
        </div>
      </section>

      {r.monthlyGrantCents > 0 && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
          Monthly member credit for your tier: <span className="font-semibold text-white">{formatPrice(r.monthlyGrantCents)}</span>
          {r.grantedThisMonth ? ' — added this month.' : ' — added once per month.'}
        </p>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">History</h2>
      {r.history.length === 0 ? (
        <EmptyState title="No credit activity yet." />
      ) : (
        <ul className="vip-surface divide-y divide-white/[0.06]">
          {r.history.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate text-white/85">{t.description}</p>
                <p className="text-xs text-white/45">{new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
              </div>
              <span className={t.amountCents >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-white/70'}>
                {t.amountCents >= 0 ? '+' : '−'}
                {formatPrice(Math.abs(t.amountCents))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-white/40">
        Full account history: <a href={GLOBAL_LINKS.credits()} className="underline hover:text-white/70">vitalityproject.global/account/credits</a>
      </p>
    </div>
  )
}
