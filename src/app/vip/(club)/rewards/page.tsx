import Link from 'next/link'
import { Award, CalendarClock, ExternalLink, Gift, Lock, ShoppingBag, Sparkles, Timer, TrendingUp } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getRewardsSummary } from '@/lib/vip/rewards-view'
import { getPointsHub } from '@/lib/vip/points-view'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { VIP_COPY } from '@/lib/vip/copy'
import { REWARDS_COPY as C } from '@/lib/vip/rewards-copy'
import { formatPrice } from '@/lib/utils'
import { EmptyState, TierBadge } from '@/components/vip/ui'
import { MemberCard } from '@/components/vip/rewards/member-card'
import { CopyLink } from '@/components/vip/rewards/copy-link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Rewards' }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * Rewards hub: the points balance (shared ledger, lib/vip/points.ts) and
 * member card, how to earn (live settings), badges and history — plus the
 * monthly store credit, which is spent at vitalityproject.global checkout.
 */
export default async function RewardsPage() {
  const viewer = await requireVipPage('member')
  const [hub, r] = await Promise.all([getPointsHub(viewer), getRewardsSummary(viewer)])
  const R = VIP_COPY.rewards
  const icons = [CalendarClock, ShoppingBag, Timer]
  const howArgs = [r.monthlyGrantCents, 0, r.expiryMonths]

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="vip-surface-strong p-5 sm:p-6" aria-labelledby="pts">
          <p id="pts" className="vip-kicker">{C.pointsLabel}</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight" data-testid="points-balance">
            {hub.points.toLocaleString('en-US')}
            <span className="ml-2 text-lg font-semibold text-white/55">pts</span>
          </p>
          <p className="mt-1 text-sm text-white/65">
            Worth <span className="font-semibold text-white">{formatPrice(hub.valueCents)}</span> · 100 points = $1
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TierBadge tier={hub.tier} admin={viewer.isAdmin && hub.tier === 'NONE'} />
            {hub.multiplier && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d4b26a]/40 bg-[#d4b26a]/10 px-2.5 py-0.5 text-[12px] font-semibold text-[#ead7a8]">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                {hub.multiplier} points · {hub.purchaseRate} back at vitalityproject.global
              </span>
            )}
          </div>
          {hub.expiry && (
            <p className={hub.expiry.soon ? 'mt-4 rounded-xl border border-amber-200/30 bg-amber-200/[0.06] px-3 py-2 text-sm text-amber-50' : 'mt-4 text-xs leading-relaxed text-white/55'} role={hub.expiry.soon ? 'status' : undefined}>
              {hub.expiry.soon ? C.expirySoon(day(hub.expiry.expiresAt)) : C.expiry(day(hub.expiry.expiresAt))}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/rewards/catalog" className="vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              <Gift className="h-4 w-4" aria-hidden="true" /> Redeem points
            </Link>
            {hub.openRedemptions > 0 && (
              <Link href="/rewards/redemptions" className="vip-focus inline-flex items-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/[0.06]">
                {hub.openRedemptions} in progress
              </Link>
            )}
          </div>
        </section>
        <MemberCard name={viewer.displayName} tierLabel={viewer.isAdmin && hub.tier === 'NONE' ? 'Vitality team' : hub.tierLabel} memberNumber={hub.memberNumber} memberNumberRaw={hub.memberNumberRaw} />
      </div>

      <section aria-labelledby="earn">
        <h2 id="earn" className="mb-3 text-lg font-semibold">{C.earnTitle}</h2>
        <div className="vip-surface overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">Points for each activity</caption>
            <tbody className="divide-y divide-white/[0.06]">
              {hub.earning.map((e) => (
                <tr key={e.key}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-white/85">
                    {e.action}
                    {e.note && <span className="mt-0.5 block text-xs font-normal text-white/55">{e.note}</span>}
                  </th>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-300">{e.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="refer" className="vip-surface p-5">
        <h2 id="refer" className="flex items-center gap-2 font-semibold">
          <Sparkles className="vip-gold h-4 w-4" aria-hidden="true" /> {C.referTitle}
        </h2>
        <p className="mt-1 text-sm text-white/65">{C.referBody(hub.referralPoints.toLocaleString('en-US'))}</p>
        <div className="mt-3">
          <CopyLink value={hub.referralLink} label="Your invite link" />
        </div>
      </section>

      <section aria-labelledby="badges">
        <h2 id="badges" className="mb-3 text-lg font-semibold">{C.badgesTitle}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {hub.badges.map((b) => (
            <li key={b.key} className={b.earned ? 'vip-surface vip-premium p-4' : 'vip-surface p-4 opacity-75'}>
              <div className="flex items-center gap-2">
                {b.earned ? <Award className="vip-gold h-5 w-5" aria-hidden="true" /> : <Lock className="h-4 w-4 text-white/50" aria-hidden="true" />}
                <p className="text-sm font-semibold">{b.label}</p>
              </div>
              <p className="mt-1.5 text-xs text-white/60">{b.earned && b.awardedAt ? `Earned ${day(b.awardedAt)}` : b.hint}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="hist">
        <h2 id="hist" className="mb-3 text-lg font-semibold">{C.historyTitle}</h2>
        {hub.history.length === 0 ? (
          <EmptyState title={C.emptyHistory.title}>{C.emptyHistory.body}</EmptyState>
        ) : (
          <ul className="vip-surface divide-y divide-white/[0.06]" data-testid="points-history">
            {hub.history.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-white/85">{t.label}</p>
                  <p className="text-xs text-white/45">{day(t.createdAt)}</p>
                </div>
                <span className={t.points >= 0 ? 'shrink-0 font-semibold text-emerald-300' : 'shrink-0 font-semibold text-white/70'}>
                  {t.points >= 0 ? '+' : '−'}
                  {Math.abs(t.points).toLocaleString('en-US')} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="credit" className="space-y-4">
        <h2 id="credit" className="text-lg font-semibold">{C.creditTitle}</h2>
        <div className="vip-surface-strong vip-premium p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="vip-kicker">{R.balanceLabel}</p>
              <p className="vip-gold mt-2 text-4xl font-extrabold tracking-tight" data-testid="reward-balance">{formatPrice(r.balanceCents)}</p>
              {r.monthlyGrantCents > 0 && (
                <p className="mt-2 text-sm text-white/60">
                  {formatPrice(r.monthlyGrantCents)} every month on your {r.tierLabel} level
                  {r.grantedThisMonth ? ' — this month’s is in.' : ' — next deposit on the 1st.'}
                </p>
              )}
            </div>
            <a href={GLOBAL_LINKS.shop()} className="vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              {R.shopCta} <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
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
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="vip-surface p-4">
            <p className="text-xs text-white/50">Member pricing at checkout</p>
            <p className="mt-1 text-xl font-bold">{r.storePerks.memberDiscountPct}% off</p>
          </div>
          <div className="vip-surface p-4">
            <p className="text-xs text-white/50">Shipping</p>
            <p className="mt-1 text-xl font-bold">{r.storePerks.freeShipping ? 'Free on every order' : 'Standard rates'}</p>
          </div>
        </div>

        {r.expiries.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-white/80">{R.expiringTitle}</h3>
            <ul className="vip-surface divide-y divide-white/[0.06]">
              {r.expiries.map((e) => (
                <li key={e.issuedAt} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-white/75">Issued {day(e.issuedAt)} · good through {day(new Date(new Date(e.expiresAt).getTime() - 86400e3).toISOString())}</span>
                  <span className="font-semibold">{formatPrice(e.cents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-white/80">{C.creditHistoryTitle}</h3>
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
          <p className="mt-3 text-xs text-white/40">
            <a href={GLOBAL_LINKS.credits()} className="underline hover:text-white/70">{R.fullHistory}</a>
          </p>
        </div>
      </section>
    </div>
  )
}
