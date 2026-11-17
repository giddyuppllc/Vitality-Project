import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight, Award, BookOpen, CalendarDays, Check, ChevronDown, ClipboardCheck, Dumbbell, Gift, Lock, MessagesSquare, Minus,
  PlayCircle, Route, ShieldCheck, Sparkles, Users,
} from 'lucide-react'
import type { MembershipTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getVipViewer, PAID_TIERS, TIER_RANK } from '@/lib/vip/access'
import { TIER_BENEFITS } from '@/lib/membership'
import { GLOBAL_LINKS, globalUrl } from '@/lib/vip/links'
import { VIP_COPY, faq, tierBullets } from '@/lib/vip/copy'
import { LANDING, LANDING_FAQ_EXTRA } from '@/lib/vip/landing-copy'
import { getTierRewardSettings } from '@/lib/vip/rewards'
import { getVipSettings } from '@/lib/vip/settings'
import { Wordmark } from '@/components/vip/ui'
import { Monogram } from '@/components/vip/monogram'
import { SignOutButton } from '@/components/vip/sign-out-button'
import { formatPrice, cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

/**
 * Public landing — the only clubhouse page a non-member sees (besides
 * sign-in, guidelines, privacy and certificate verification). Nothing from
 * the community is shown. Members go straight to their home (/dashboard).
 * Joining hands off to .global's existing Zelle membership flow with the
 * chosen tier preselected. Every number is live data or a live setting.
 */
export default async function VipLanding() {
  const viewer = await getVipViewer()
  if (viewer?.isMember) redirect('/dashboard')

  const [credits, settings, courses, tracks, upcoming] = await Promise.all([
    getTierRewardSettings(),
    getVipSettings(),
    prisma.vipCourse.findMany({ where: { published: true }, select: { minTier: true, purchaseOnly: true } }),
    prisma.vipTrack.findMany({
      where: { published: true, courses: { some: { published: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { title: true },
    }),
    prisma.vipEvent.findMany({
      where: { published: true, cancelledAt: null, startsAt: { gte: new Date() } },
      select: { minTier: true },
      take: 100,
    }),
  ])
  const included = (t: MembershipTier) => courses.filter((c) => !c.purchaseOnly && TIER_RANK[t] >= TIER_RANK[c.minTier === 'NONE' ? 'CLUB' : c.minTier]).length
  const sessionsFor = (t: MembershipTier) => upcoming.filter((e) => TIER_RANK[t] >= TIER_RANK[e.minTier === 'NONE' ? 'CLUB' : e.minTier]).length
  const lessonPts = settings['vip.points.lessonComplete']
  const coursePts = settings['vip.points.courseComplete']
  const P = LANDING.pillars

  const pillars = [
    { key: 'community', icon: MessagesSquare, tone: 'text-brand-300', ...P.community },
    { key: 'academy', icon: BookOpen, tone: 'text-[#ead7a8]', ...P.academy },
    { key: 'training', icon: Dumbbell, tone: 'text-emerald-200', ...P.training },
    { key: 'rewards', icon: Gift, tone: 'text-[#ead7a8]', ...P.rewards },
  ]

  type Cell = string | boolean
  const rows: Array<{ label: string; cells: Record<(typeof PAID_TIERS)[number], Cell> }> = [
    { label: 'Monthly price', cells: { CLUB: formatPrice(TIER_BENEFITS.CLUB.monthlyPriceCents), PLUS: formatPrice(TIER_BENEFITS.PLUS.monthlyPriceCents), PREMIUM: formatPrice(TIER_BENEFITS.PREMIUM.monthlyPriceCents) } },
    { label: 'Community, spaces & directory', cells: { CLUB: true, PLUS: true, PREMIUM: true } },
    ...(courses.length
      ? [{ label: 'Academy courses included', cells: { CLUB: String(included('CLUB')), PLUS: String(included('PLUS')), PREMIUM: String(included('PREMIUM')) } }]
      : []),
    {
      label: 'Live sessions & recordings',
      cells: upcoming.length
        ? { CLUB: `${sessionsFor('CLUB')} scheduled`, PLUS: `${sessionsFor('PLUS')} scheduled`, PREMIUM: `${sessionsFor('PREMIUM')} scheduled` }
        : { CLUB: true, PLUS: true, PREMIUM: true },
    },
    { label: 'Workouts, habits & check-ins', cells: { CLUB: true, PLUS: true, PREMIUM: true } },
    { label: 'Points for learning', cells: { CLUB: true, PLUS: true, PREMIUM: true } },
    { label: 'Store credit on the 1st', cells: { CLUB: credits.CLUB ? usd(credits.CLUB) : false, PLUS: credits.PLUS ? usd(credits.PLUS) : false, PREMIUM: credits.PREMIUM ? usd(credits.PREMIUM) : false } },
    {
      label: 'Member pricing at vitalityproject.global',
      cells: { CLUB: `${TIER_BENEFITS.CLUB.permanentDiscountPct}%`, PLUS: `${TIER_BENEFITS.PLUS.permanentDiscountPct}%`, PREMIUM: `${TIER_BENEFITS.PREMIUM.permanentDiscountPct}%` },
    },
    { label: 'Free shipping', cells: { CLUB: TIER_BENEFITS.CLUB.freeShipping, PLUS: TIER_BENEFITS.PLUS.freeShipping, PREMIUM: TIER_BENEFITS.PREMIUM.freeShipping } },
  ]

  const questions = [...faq({ expiryMonths: settings['vip.rewardExpiryMonths'], credits }), ...LANDING_FAQ_EXTRA]

  return (
    <div className="vip-landing">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex h-20 items-center justify-between">
          <Wordmark />
          {viewer ? (
            <span className="hidden text-sm text-white/65 sm:inline">Signed in as {viewer.displayName}</span>
          ) : (
            <Link href="/signin" className="vip-focus inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/[0.06]">
              Sign in
            </Link>
          )}
        </header>
      </div>

      <main id="main" className="pb-16">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-6 sm:px-6 sm:pt-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/80">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> {LANDING.eyebrow}
            </span>
            <h1 className="mt-5 text-[38px] font-extrabold leading-[1.05] tracking-tight sm:text-[56px]">{LANDING.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{LANDING.intro}</p>

            {viewer && !viewer.isMember ? (
              <div className="vip-surface-strong mt-8 max-w-xl p-5" data-testid="nonmember-box">
                <p className="font-semibold">{viewer.membershipStatus === 'PENDING_PAYMENT' ? VIP_COPY.landing.pendingTitle : VIP_COPY.landing.nonMemberTitle}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/70">
                  {viewer.membershipStatus === 'PENDING_PAYMENT' ? VIP_COPY.landing.pendingBody : VIP_COPY.landing.nonMemberBody}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href="#levels" className="vip-focus inline-flex min-h-[44px] items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
                    Choose a level
                  </a>
                  <a href={GLOBAL_LINKS.manageMembership()} className="vip-focus inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/[0.06]">
                    My membership
                  </a>
                  <SignOutButton />
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#levels" className="vip-focus inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600">
                  {LANDING.ctaJoin} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <Link href="/signin" className="vip-focus inline-flex min-h-[48px] items-center rounded-xl border border-white/15 px-5 text-sm font-semibold hover:bg-white/[0.06]">
                  {LANDING.ctaSignIn}
                </Link>
              </div>
            )}

            <ul className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-2 text-sm text-white/70 sm:grid-cols-4">
              {[
                { icon: MessagesSquare, label: 'Community' },
                { icon: BookOpen, label: 'Academy' },
                { icon: Dumbbell, label: 'Training' },
                { icon: Gift, label: 'Rewards' },
              ].map((x) => (
                <li key={x.label} className="inline-flex items-center gap-2">
                  <x.icon className="h-4 w-4 text-brand-300" aria-hidden="true" /> {x.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Product illustration (feature examples, no member data) */}
          <div className="relative mx-auto w-full max-w-[380px]" aria-hidden="true">
            <div className="absolute -inset-8 rounded-[40px] bg-[radial-gradient(closest-side,rgba(29,111,214,0.28),transparent)]" />
            <div className="vip-surface-strong vip-premium relative space-y-3 p-5">
              <div className="flex items-center gap-3">
                <Monogram size={44} />
                <div>
                  <p className="vip-kicker">Your Clubhouse</p>
                  <p className="font-bold">Good morning</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                  <PlayCircle className="h-4 w-4 text-brand-300" /> Continue learning
                </p>
                <p className="mt-1 font-semibold">How to read a certificate of analysis</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/3 rounded-full bg-brand-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                  <Dumbbell className="h-5 w-5 text-emerald-200" />
                  <p className="mt-2 text-sm font-semibold">Today’s workout</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                  <ClipboardCheck className="h-5 w-5 text-brand-200" />
                  <p className="mt-2 text-sm font-semibold">Daily check-in</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[#d4b26a]/35 bg-[#d4b26a]/[0.08] p-3.5">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="vip-gold h-4 w-4" /> Lesson complete
                </span>
                {lessonPts > 0 && <span className="text-sm font-bold text-[#ead7a8]">+{lessonPts} points</span>}
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <Award className="vip-gold h-5 w-5" />
                <span className="text-sm font-semibold">Certificate issued</span>
                <ShieldCheck className="ml-auto h-4 w-4 text-emerald-300" />
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6" aria-labelledby="inside">
          <p className="vip-kicker">{LANDING.pillarsKicker}</p>
          <h2 id="inside" className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Four parts of a healthier life, working together.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {pillars.map((p) => (
              <article key={p.key} className="vip-surface relative overflow-hidden p-6 sm:p-7">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
                  <p.icon className={cn('h-5 w-5', p.tone)} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-bold tracking-tight">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-white/70">{p.body}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.points.map((x) => (
                    <li key={x} className="flex gap-2.5 text-white/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" /> {x}
                    </li>
                  ))}
                </ul>
                {p.key === 'academy' && tracks.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Learning paths">
                    {tracks.map((t) => (
                      <span key={t.title} className="inline-flex items-center gap-1 rounded-full border border-[#d4b26a]/35 bg-[#d4b26a]/[0.08] px-2.5 py-1 text-xs font-medium text-[#ead7a8]">
                        <Route className="h-3 w-3" aria-hidden="true" /> {t.title}
                      </span>
                    ))}
                  </div>
                )}
                {p.key === 'rewards' && lessonPts + coursePts > 0 && (
                  <p className="mt-5 text-sm text-white/70">
                    {lessonPts > 0 && <>A finished lesson earns {lessonPts} points</>}
                    {lessonPts > 0 && coursePts > 0 && <>, a finished course {coursePts}. </>}
                    {lessonPts === 0 && coursePts > 0 && <>A finished course earns {coursePts} points. </>}
                    100 points = $1.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Live */}
        <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6" aria-labelledby="live">
          <div className="vip-surface-strong flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-inset ring-brand-400/25">
              <CalendarDays className="h-6 w-6 text-brand-300" aria-hidden="true" />
            </span>
            <div>
              <h2 id="live" className="text-xl font-bold tracking-tight">
                {LANDING.liveTitle}
              </h2>
              <p className="mt-1.5 max-w-3xl leading-relaxed text-white/70">{LANDING.liveBody}</p>
            </div>
          </div>
        </section>

        {/* Levels */}
        <section id="levels" className="mx-auto mt-24 max-w-6xl scroll-mt-6 px-4 sm:px-6" aria-labelledby="tiers">
          <p className="vip-kicker">{LANDING.compareKicker}</p>
          <h2 id="tiers" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {LANDING.compareTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-white/70">{LANDING.compareIntro}</p>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {PAID_TIERS.map((t) => {
              const b = TIER_BENEFITS[t]
              const premium = t === 'PREMIUM'
              const popular = t === 'PLUS'
              return (
                <div key={t} className={cn('vip-surface relative flex flex-col p-6', premium && 'vip-premium', popular && 'border-brand-400/40')} data-testid={`tier-${t}`}>
                  {popular && (
                    <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Most chosen</span>
                  )}
                  <div className="flex items-center gap-2">
                    {premium && <Sparkles className="vip-gold h-4 w-4" aria-hidden="true" />}
                    <h3 className={cn('text-lg font-bold', premium && 'vip-gold-soft')}>{VIP_COPY.tiers[t].name}</h3>
                  </div>
                  <p className="mt-0.5 text-sm text-white/65">{VIP_COPY.tiers[t].tagline}</p>
                  <p className="mt-4 text-4xl font-extrabold tracking-tight">
                    {formatPrice(b.monthlyPriceCents)}
                    <span className="text-sm font-medium text-white/60"> / month</span>
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {tierBullets(t, { monthlyCreditCents: credits[t], discountPct: b.permanentDiscountPct, freeShipping: b.freeShipping }).map((x) => (
                      <li key={x} className="flex gap-2.5 text-white/80">
                        <Check className={cn('mt-0.5 h-4 w-4 shrink-0', premium ? 'vip-gold' : 'text-brand-300')} aria-hidden="true" />
                        {x}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={GLOBAL_LINKS.joinTier(t)}
                    data-testid={`join-${t}`}
                    className={cn(
                      'vip-focus mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl text-sm font-semibold',
                      premium ? 'vip-bg-gold hover:opacity-90' : popular ? 'bg-brand-500 text-white hover:bg-brand-600' : 'border border-white/15 hover:bg-white/[0.06]',
                    )}
                  >
                    Join {VIP_COPY.tiers[t].name} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              )
            })}
          </div>

          {/* Comparison */}
          <div className="vip-surface mt-6 overflow-hidden">
            <table className="w-full table-fixed text-left text-sm" data-testid="tier-compare">
              <caption className="sr-only">Compare membership levels</caption>
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th scope="col" className="w-[40%] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-white/60 sm:px-5">
                    <span className="sr-only">Feature</span>
                  </th>
                  {PAID_TIERS.map((t) => (
                    <th key={t} scope="col" className={cn('px-2 py-3 text-center text-[13px] font-bold sm:px-4', t === 'PREMIUM' && 'text-[#ead7a8]')}>
                      {VIP_COPY.tiers[t].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="px-3 py-3 text-[13px] font-medium text-white/80 sm:px-5">
                      {r.label}
                    </th>
                    {PAID_TIERS.map((t) => {
                      const v = r.cells[t]
                      return (
                        <td key={t} className="px-2 py-3 text-center text-[13px] sm:px-4">
                          {v === true ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-300" aria-label="Included" />
                          ) : v === false ? (
                            <Minus className="mx-auto h-4 w-4 text-white/40" aria-label="Not included" />
                          ) : (
                            <span className="font-semibold">{v}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-white/60">{LANDING.compareNote}</p>
        </section>

        {/* How joining works */}
        <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6" aria-labelledby="steps">
          <p className="vip-kicker">Joining</p>
          <h2 id="steps" className="mt-2 text-3xl font-bold tracking-tight">
            {LANDING.stepsTitle}
          </h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {VIP_COPY.joinSteps.map((s, i) => (
              <li key={s.title} className="vip-surface p-5">
                <span className="vip-gold text-sm font-bold">0{i + 1}</span>
                <p className="mt-2 font-semibold">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-24 max-w-3xl px-4 sm:px-6" aria-labelledby="faq">
          <p className="vip-kicker">Questions</p>
          <h2 id="faq" className="mt-2 text-3xl font-bold tracking-tight">
            {VIP_COPY.landing.faqTitle}
          </h2>
          <div className="mt-6 space-y-2">
            {questions.map((f) => (
              <details key={f.q} className="vip-surface group p-0 [&_summary::-webkit-details-marker]:hidden">
                <summary className="vip-focus flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 rounded-[18px] px-5 py-4 font-semibold">
                  {f.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/60 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-white/75">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 flex gap-3 rounded-2xl border border-white/10 p-4 text-sm text-white/70">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
            <p>
              <span className="font-semibold text-white/85">{LANDING.guardrailTitle}.</span> {LANDING.guardrailBody}
            </p>
          </div>
        </section>

        {/* Closing */}
        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <div className="vip-surface-strong vip-premium flex flex-col items-start gap-5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="flex items-center gap-4">
              <Monogram size={52} />
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{LANDING.closingTitle}</h2>
                <p className="mt-1.5 text-white/70">{LANDING.closingBody}</p>
              </div>
            </div>
            <a href="#levels" className="vip-focus inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600">
              {LANDING.ctaJoin} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-white/[0.07] px-4 py-7 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="inline-flex items-center gap-2">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> {VIP_COPY.landing.footerTagline}
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link href="/guidelines" className="vip-focus rounded hover:text-white/85">Guidelines</Link>
          <Link href="/privacy" className="vip-focus rounded hover:text-white/85">Privacy</Link>
          <Link href="/verify" className="vip-focus rounded hover:text-white/85">Verify a certificate</Link>
          <a href={globalUrl('/')} className="vip-focus rounded hover:text-white/85">vitalityproject.global</a>
        </nav>
      </footer>
    </div>
  )
}
