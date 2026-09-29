import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, BookOpen, CalendarDays, Check, Gift, Lock, MessagesSquare, Sparkles } from 'lucide-react'
import { getVipViewer, PAID_TIERS } from '@/lib/vip/access'
import { TIER_BENEFITS } from '@/lib/membership'
import { GLOBAL_LINKS, globalUrl } from '@/lib/vip/links'
import { VIP_COPY, faq, tierBullets } from '@/lib/vip/copy'
import { getTierRewardSettings } from '@/lib/vip/rewards'
import { getVipSetting } from '@/lib/vip/settings'
import { Wordmark } from '@/components/vip/ui'
import { Monogram } from '@/components/vip/monogram'
import { formatPrice, cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Public landing — the only clubhouse page a non-member sees (besides sign-in,
 * guidelines and privacy). Nothing from the community is shown here. Members
 * go straight to the feed. Joining hands off to .global's existing Zelle
 * membership flow with the chosen tier preselected.
 */
export default async function VipLanding() {
  const viewer = await getVipViewer()
  if (viewer?.isMember) redirect(viewer.suspended ? '/classroom' : '/feed')

  const [credits, expiryMonths] = await Promise.all([getTierRewardSettings(), getVipSetting('vip.rewardExpiryMonths')])
  const L = VIP_COPY.landing
  const features = [
    { icon: MessagesSquare, ...L.features.community },
    { icon: BookOpen, ...L.features.classroom },
    { icon: CalendarDays, ...L.features.events },
    { icon: Gift, ...L.features.rewards },
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex h-20 items-center justify-between">
        <Wordmark />
        {viewer ? (
          <span className="hidden text-sm text-white/60 sm:inline">Signed in as {viewer.displayName}</span>
        ) : (
          <Link href="/signin" className="vip-focus rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/[0.06]">
            Sign in
          </Link>
        )}
      </header>

      <main id="main" className="flex-1 pb-16">
        {/* Hero */}
        <section className="grid items-center gap-10 pt-6 sm:pt-14 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/75">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> {L.eyebrow}
            </span>
            <h1 className="mt-5 text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{L.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">{L.intro}</p>

            {viewer && !viewer.isMember ? (
              <div className="vip-surface-strong mt-8 max-w-xl p-5" data-testid="nonmember-box">
                <p className="font-semibold">{viewer.membershipStatus === 'PENDING_PAYMENT' ? L.pendingTitle : L.nonMemberTitle}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">
                  {viewer.membershipStatus === 'PENDING_PAYMENT' ? L.pendingBody : L.nonMemberBody}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href="#levels" className="vip-focus rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
                    Choose a level
                  </a>
                  <a href={GLOBAL_LINKS.manageMembership()} className="vip-focus rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/[0.06]">
                    My membership
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#levels" className="vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600">
                  {L.ctaJoin} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <Link href="/signin" className="vip-focus rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/[0.06]">
                  {L.ctaSignIn}
                </Link>
              </div>
            )}

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              {L.proof.map((p) => (
                <li key={p} className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-brand-300" aria-hidden="true" /> {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative hidden justify-center lg:flex" aria-hidden="true">
            <div className="vip-surface-strong vip-premium flex aspect-square w-full max-w-[340px] flex-col items-center justify-center gap-5 p-10">
              <Monogram size={148} />
              <p className="vip-kicker">The Vitality Project</p>
              <p className="-mt-3 text-2xl font-extrabold tracking-tight">Clubhouse</p>
              <p className="vip-gold text-sm font-semibold">{VIP_COPY.brandLine}</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-20" aria-labelledby="inside">
          <p className="vip-kicker">{L.featuresTitle}</p>
          <h2 id="inside" className="sr-only">{L.featuresTitle}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="vip-surface p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand-400/25 bg-brand-500/10">
                  <f.icon className="h-5 w-5 text-brand-300" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/62">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Levels */}
        <section id="levels" className="mt-20 scroll-mt-6" aria-labelledby="tiers">
          <p className="vip-kicker">Membership</p>
          <h2 id="tiers" className="mt-2 text-3xl font-bold tracking-tight">{L.tiersTitle}</h2>
          <p className="mt-2 max-w-2xl text-white/65">{L.tiersIntro}</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {PAID_TIERS.map((t) => {
              const b = TIER_BENEFITS[t]
              const premium = t === 'PREMIUM'
              const popular = t === 'PLUS'
              return (
                <div
                  key={t}
                  className={cn('vip-surface relative flex flex-col p-6', premium && 'vip-premium', popular && 'border-brand-400/40')}
                  data-testid={`tier-${t}`}
                >
                  {popular && (
                    <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                      Most chosen
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {premium && <Sparkles className="vip-gold h-4 w-4" aria-hidden="true" />}
                    <p className={cn('text-lg font-bold', premium && 'vip-gold-soft')}>{VIP_COPY.tiers[t].name}</p>
                  </div>
                  <p className="mt-0.5 text-sm text-white/55">{VIP_COPY.tiers[t].tagline}</p>
                  <p className="mt-4 text-4xl font-extrabold tracking-tight">
                    {formatPrice(b.monthlyPriceCents)}
                    <span className="text-sm font-medium text-white/50"> / month</span>
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {tierBullets(t, { monthlyCreditCents: credits[t], discountPct: b.permanentDiscountPct, freeShipping: b.freeShipping }).map((x) => (
                      <li key={x} className="flex gap-2.5 text-white/75">
                        <Check className={cn('mt-0.5 h-4 w-4 shrink-0', premium ? 'vip-gold' : 'text-brand-300')} aria-hidden="true" />
                        {x}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={GLOBAL_LINKS.joinTier(t)}
                    data-testid={`join-${t}`}
                    className={cn(
                      'vip-focus mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold',
                      premium ? 'vip-bg-gold hover:opacity-90' : popular ? 'bg-brand-500 text-white hover:bg-brand-600' : 'border border-white/15 hover:bg-white/[0.06]',
                    )}
                  >
                    Join {VIP_COPY.tiers[t].name} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-white/45">Membership is billed monthly by Zelle through vitalityproject.global. Change or cancel your level anytime.</p>
        </section>

        {/* How joining works */}
        <section className="mt-20" aria-labelledby="steps">
          <p className="vip-kicker">Joining</p>
          <h2 id="steps" className="mt-2 text-3xl font-bold tracking-tight">{L.stepsTitle}</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {VIP_COPY.joinSteps.map((s, i) => (
              <li key={s.title} className="vip-surface p-5">
                <span className="vip-gold text-sm font-bold">0{i + 1}</span>
                <p className="mt-2 font-semibold">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/62">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="mt-20" aria-labelledby="faq">
          <p className="vip-kicker">Questions</p>
          <h2 id="faq" className="mt-2 text-3xl font-bold tracking-tight">{L.faqTitle}</h2>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {faq({ expiryMonths, credits }).map((f) => (
              <div key={f.q} className="vip-surface p-5">
                <p className="font-semibold">{f.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="vip-surface-strong mt-20 flex flex-col items-start gap-5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{L.closingTitle}</h2>
            <p className="mt-1.5 text-white/65">{L.closingBody}</p>
          </div>
          <a href="#levels" className="vip-focus inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
            {L.ctaJoin} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </section>
      </main>

      <footer className="flex flex-col gap-3 border-t border-white/[0.07] py-7 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
        <p>{L.footerTagline}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link href="/guidelines" className="hover:text-white/80">Guidelines</Link>
          <Link href="/privacy" className="hover:text-white/80">Privacy</Link>
          <a href={globalUrl('/')} className="hover:text-white/80">vitalityproject.global</a>
        </nav>
      </footer>
    </div>
  )
}
