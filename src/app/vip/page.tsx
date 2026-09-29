import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, CalendarDays, Gift, Lock, MessagesSquare } from 'lucide-react'
import { getVipViewer, PAID_TIERS } from '@/lib/vip/access'
import { TIER_BENEFITS } from '@/lib/membership'
import { GLOBAL_LINKS, globalUrl } from '@/lib/vip/links'
import { VIP_COPY } from '@/lib/vip/copy'
import { CopyPlaceholder, Wordmark } from '@/components/vip/ui'
import { formatPrice } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Public landing — the only clubhouse page a non-member sees (besides sign-in).
 * Nothing from the community is shown here. Members go straight to the feed.
 * All descriptive copy is a Kevin/Edward slot (lib/vip/copy.ts).
 */
export default async function VipLanding() {
  const viewer = await getVipViewer()
  if (viewer?.isMember) redirect(viewer.suspended ? '/classroom' : '/feed')

  const features = [
    { icon: MessagesSquare, label: 'Community', slot: 'landingCommunity' as const },
    { icon: BookOpen, label: 'Classroom', slot: 'landingClassroom' as const },
    { icon: CalendarDays, label: 'Live events', slot: 'landingEvents' as const },
    { icon: Gift, label: 'Rewards at vitalityproject.global', slot: 'landingRewards' as const },
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex h-20 items-center justify-between">
        <Wordmark />
        {viewer ? (
          <span className="text-sm text-white/60">Signed in as {viewer.displayName}</span>
        ) : (
          <Link href="/signin" className="vip-focus rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/[0.06]">
            Sign in
          </Link>
        )}
      </header>

      <main id="main" className="flex-1 pb-16 pt-8 sm:pt-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/70">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Members only
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">The Vitality Project Clubhouse</h1>
          <div className="mt-5 space-y-3 text-lg text-white/70">
            <CopyPlaceholder slot="landingHeadline" text={VIP_COPY.landingHeadline} />
            <CopyPlaceholder slot="landingIntro" text={VIP_COPY.landingIntro} />
          </div>

          {viewer && !viewer.isMember && (
            <div className="vip-surface-strong mt-8 p-5">
              <p className="font-semibold">Your account does not have an active membership.</p>
              <p className="mt-1 text-sm text-white/60">
                Membership is managed at vitalityproject.global. Once it is active, the clubhouse opens here.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={GLOBAL_LINKS.join()} className="vip-focus rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
                  View memberships
                </a>
                <a href={GLOBAL_LINKS.manageMembership()} className="vip-focus rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/[0.06]">
                  My membership
                </a>
              </div>
            </div>
          )}

          {!viewer && (
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={GLOBAL_LINKS.join()} className="vip-focus rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600">
                Join
              </a>
              <Link href="/signin" className="vip-focus rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/[0.06]">
                Member sign in
              </Link>
            </div>
          )}
        </div>

        <section className="mt-14 grid gap-3 sm:grid-cols-2" aria-label="What's inside">
          {features.map((f) => (
            <div key={f.label} className="vip-surface p-5">
              <f.icon className="h-5 w-5 text-brand-300" aria-hidden="true" />
              <h2 className="mt-3 font-semibold">{f.label}</h2>
              <CopyPlaceholder slot={f.slot} text={VIP_COPY[f.slot]} className="mt-2 text-sm text-white/60" />
            </div>
          ))}
        </section>

        <section className="mt-14" aria-labelledby="tiers">
          <h2 id="tiers" className="text-lg font-semibold">Membership tiers</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PAID_TIERS.map((t) => (
              <div key={t} className="vip-surface p-5">
                <p className="font-semibold">{TIER_BENEFITS[t].label}</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatPrice(TIER_BENEFITS[t].monthlyPriceCents)}
                  <span className="text-sm font-medium text-white/50"> / month</span>
                </p>
                <a href={GLOBAL_LINKS.join()} className="vip-focus mt-4 inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">
                  Join at vitalityproject.global →
                </a>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] py-6 text-xs text-white/40">
        <a href={globalUrl('/')} className="hover:text-white/70">vitalityproject.global</a>
      </footer>
    </div>
  )
}
