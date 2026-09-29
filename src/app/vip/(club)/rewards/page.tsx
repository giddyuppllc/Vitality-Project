import { CalendarClock, ExternalLink, Gift, ShoppingBag, Timer } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getRewardsSummary } from '@/lib/vip/rewards-view'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { VIP_COPY } from '@/lib/vip/copy'
import { formatPrice } from '@/lib/utils'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Rewards' }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * Rewards are spent at vitalityproject.global — this page shows the balance
 * and history from the shared StoreCredit ledger and hands off to the store.
 * There is no checkout on the clubhouse.
 */
export default async function RewardsPage() {
  const viewer = await requireVipPage('member')
  const r = await getRewardsSummary(viewer)
  const R = VIP_COPY.rewards
  const icons = [CalendarClock, ShoppingBag, Timer]
  const howArgs = [r.monthlyGrantCents, 0, r.expiryMonths]

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={R.title} intro={R.intro} />

      <section className="vip-surface-strong vip-premium p-5 sm:p-6" aria-labelledby="bal">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p id="bal" className="vip-kicker">{R.balanceLabel}</p>
            <p className="vip-gold mt-2 text-5xl font-extrabold tracking-tight" data-testid="reward-balance">{formatPrice(r.balanceCents)}</p>
            {r.monthlyGrantCents > 0 && (
              <p className="mt-2 text-sm text-white/60">
                {formatPrice(r.monthlyGrantCents)} every month on your {r.tierLabel} level
                {r.grantedThisMonth ? ' — this month’s is in.' : ' — next deposit on the 1st.'}
              </p>
            )}
          </div>
          <a
            href={GLOBAL_LINKS.shop()}
            className="vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            {R.shopCta} <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="How rewards work">
        {R.how.map((h, i) => {
          const Icon = icons[i]
          return (
            <div key={h.title} className="vip-surface p-4">
              <Icon className="h-5 w-5 text-brand-300" aria-hidden="true" />
              <p className="mt-2.5 text-sm font-semibold">{h.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/60">{h.body(howArgs[i])}</p>
            </div>
          )
        })}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Membership perks at vitalityproject.global">
        <div className="vip-surface p-4">
          <p className="text-xs text-white/50">Your level</p>
          <div className="mt-2">
            <TierBadge tier={r.tier} admin={viewer.isAdmin && r.tier === 'NONE'} />
          </div>
        </div>
        <div className="vip-surface p-4">
          <p className="text-xs text-white/50">Member pricing at checkout</p>
          <p className="mt-1 text-xl font-bold">{r.storePerks.memberDiscountPct}% off</p>
        </div>
        <div className="vip-surface p-4">
          <p className="text-xs text-white/50">Shipping</p>
          <p className="mt-1 text-xl font-bold">{r.storePerks.freeShipping ? 'Free on every order' : 'Standard rates'}</p>
        </div>
      </section>

      {r.expiries.length > 0 && (
        <section className="mt-8" aria-labelledby="exp">
          <h2 id="exp" className="mb-3 text-lg font-semibold">{R.expiringTitle}</h2>
          <ul className="vip-surface divide-y divide-white/[0.06]">
            {r.expiries.map((e) => (
              <li key={e.issuedAt} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-white/75">Issued {day(e.issuedAt)} · good through {day(new Date(new Date(e.expiresAt).getTime() - 86400e3).toISOString())}</span>
                <span className="font-semibold">{formatPrice(e.cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">{R.historyTitle}</h2>
      {r.history.length === 0 ? (
        <EmptyState title={VIP_COPY.empty.rewardsHistory.title}>{VIP_COPY.empty.rewardsHistory.body}</EmptyState>
      ) : (
        <ul className="vip-surface divide-y divide-white/[0.06]">
          {r.history.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                {t.type === 'MEMBER_REWARD' && <Gift className="vip-gold h-4 w-4 shrink-0" aria-hidden="true" />}
                <div className="min-w-0">
                  <p className="truncate text-white/85">{t.label}</p>
                  <p className="text-xs text-white/45">{day(t.createdAt)}</p>
                </div>
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
        <a href={GLOBAL_LINKS.credits()} className="underline hover:text-white/70">{R.fullHistory}</a>
      </p>
    </div>
  )
}
