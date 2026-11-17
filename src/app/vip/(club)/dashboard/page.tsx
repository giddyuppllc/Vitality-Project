import Link from 'next/link'
import {
  ArrowRight, Award, BookOpen, ClipboardCheck, Dumbbell, Gift, Heart, ImageIcon, MessageCircle, PlayCircle, Sparkles, Trophy,
} from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { loadDashboard } from '@/lib/vip/dashboard'
import { getVipSetting } from '@/lib/vip/settings'
import { zonedParts } from '@/lib/vip/time'
import { EVENT_KIND_LABEL } from '@/lib/vip/classroom'
import { Avatar, TierBadge, timeAgo } from '@/components/vip/ui'
import { Bar, Pill, SectionHead, formatPoints } from '@/components/vip/academy-ui'
import { Greeting } from '@/components/vip/greeting'
import { LocalDateBadge, LocalTime } from '@/components/vip/local-time'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Home' }

const firstName = (s: string) => s.trim().split(/\s+/)[0] || s

/**
 * Member home — the first page after sign-in (SSO lands on /dashboard).
 * All data in one parallel load (lib/vip/dashboard.ts).
 */
export default async function DashboardPage() {
  const viewer = await requireVipPage('member')
  const [d, tz] = await Promise.all([loadDashboard(viewer), getVipSetting('vip.timeZone')])
  const hour = zonedParts(new Date(), tz).hour
  const renews = d.membership?.renewsAt
    ? new Date(d.membership.renewsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
    : null

  return (
    <div className="mx-auto max-w-6xl">
      {/* Greeting */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight sm:text-[32px]">
            <Greeting name={firstName(viewer.displayName)} serverHour={hour} />
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-white/65">
            <TierBadge tier={viewer.tier} admin={viewer.isAdmin} />
            {renews && <span>Renews {renews}</span>}
          </p>
        </div>
        <Link
          href="/rewards"
          className="vip-focus vip-surface flex min-h-[44px] items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05]"
          aria-label={`${formatPoints(d.points)} points — open Rewards`}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#d4b26a]/40 bg-[#d4b26a]/10" aria-hidden="true">
            <Gift className="vip-gold h-[18px] w-[18px]" />
          </span>
          <span className="leading-tight" aria-hidden="true">
            <span className="block text-lg font-bold tabular-nums">{formatPoints(d.points)}</span>
            <span className="block text-xs text-white/60">points</span>
          </span>
        </Link>
      </header>

      {d.needsOnboarding && (
        <Link
          href="/welcome"
          className="vip-focus vip-surface-strong vip-premium mb-6 flex items-center gap-4 p-4 hover:bg-white/[0.04] sm:p-5"
          data-testid="onboarding-banner"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#d4b26a]/15" aria-hidden="true">
            <Sparkles className="vip-gold h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Make the Clubhouse yours</span>
            <span className="block text-sm text-white/65">Two minutes: your goals, your interests and a learning path to start on.</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-white/60" aria-hidden="true" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {/* Continue learning */}
          <section aria-labelledby="learn-h">
            <SectionHead id="learn-h" title="Continue learning" href="/classroom" linkLabel="Academy" />
            {d.learning.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {d.learning.map((c, i) => {
                  const pct = c.total ? (c.done / c.total) * 100 : 0
                  return (
                    <li key={c.courseSlug} className={i === 0 ? 'sm:col-span-2' : ''}>
                      <Link href={`/classroom/lessons/${c.lessonId}`} className="vip-focus vip-surface group flex h-full items-center gap-4 p-4 hover:bg-white/[0.04] sm:p-5">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-inset ring-brand-400/25" aria-hidden="true">
                          <PlayCircle className="h-6 w-6 text-brand-300" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold uppercase tracking-wider text-white/60">{c.courseTitle}</span>
                          <span className="mt-0.5 block truncate font-semibold">{c.lessonTitle}</span>
                          <Bar pct={pct} label={`${c.courseTitle} progress`} className="mt-2.5" />
                          <span className="mt-1.5 block text-xs text-white/60">
                            {c.done} of {c.total} lessons
                          </span>
                        </span>
                        <span className="hidden shrink-0 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white group-hover:bg-brand-600 sm:inline" aria-hidden="true">
                          Resume
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : d.suggested ? (
              <Link href={`/classroom/${d.suggested.slug}`} className="vip-focus vip-surface group flex items-center gap-4 p-4 hover:bg-white/[0.04] sm:p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-inset ring-brand-400/25" aria-hidden="true">
                  <BookOpen className="h-6 w-6 text-brand-300" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-white/60">Start here</span>
                  <span className="mt-0.5 block font-semibold">{d.suggested.title}</span>
                  <span className="mt-0.5 block text-sm text-white/60">{d.suggested.lessonCount} lessons{d.suggested.track ? ` · ${d.suggested.track.title}` : ''}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-white/60" aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/classroom" className="vip-focus vip-surface flex items-center gap-4 p-5 hover:bg-white/[0.04]">
                <BookOpen className="h-6 w-6 text-brand-300" aria-hidden="true" />
                <span className="flex-1">
                  <span className="block font-semibold">Explore the Academy</span>
                  <span className="block text-sm text-white/60">Learning paths, courses and certificates.</span>
                </span>
                <ArrowRight className="h-5 w-5 text-white/60" aria-hidden="true" />
              </Link>
            )}
          </section>

          {/* Today — fitness data (lib/vip/fitness via lib/vip/dashboard.ts) */}
          <section aria-labelledby="today-h">
            <SectionHead id="today-h" title="Today" href="/fitness" linkLabel="Fitness" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href={d.fitness.openWorkout ? `/fitness/workout/${d.fitness.openWorkout.id}` : '/fitness'}
                className="vip-focus vip-surface group flex flex-col gap-3 p-5 hover:bg-white/[0.04]"
                data-testid="card-training"
              >
                <span className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 ring-1 ring-inset ring-emerald-300/25" aria-hidden="true">
                    <Dumbbell className="h-5 w-5 text-emerald-200" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-white/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-white/60">Today’s workout</span>
                  {d.fitness.openWorkout ? (
                    <>
                      <span className="mt-0.5 block truncate font-semibold">{d.fitness.openWorkout.title}</span>
                      <span className="mt-0.5 block text-sm text-amber-100">In progress — tap to resume</span>
                    </>
                  ) : d.fitness.workout && !d.fitness.workout.finished && d.fitness.workout.allowed ? (
                    <>
                      <span className="mt-0.5 block truncate font-semibold">{d.fitness.workout.rest ? 'Rest day' : d.fitness.workout.dayTitle}</span>
                      <span className="mt-0.5 block truncate text-sm text-white/65">
                        {d.fitness.workout.programTitle}
                        {d.fitness.workout.position ? ` · day ${d.fitness.workout.position.index} of ${d.fitness.workout.position.total}` : ''}
                      </span>
                    </>
                  ) : d.fitness.workout?.finished ? (
                    <>
                      <span className="mt-0.5 block truncate font-semibold">{d.fitness.workout.programTitle} — complete</span>
                      <span className="mt-0.5 block text-sm text-white/65">Pick your next program or log a free session.</span>
                    </>
                  ) : (
                    <>
                      <span className="mt-0.5 block font-semibold">No program running</span>
                      <span className="mt-0.5 block text-sm text-white/65">Choose a program or log whatever you train today.</span>
                    </>
                  )}
                </span>
              </Link>
              <Link href="/fitness/health" className="vip-focus vip-surface group flex flex-col gap-3 p-5 hover:bg-white/[0.04]" data-testid="card-checkin">
                <span className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 ring-1 ring-inset ring-brand-400/25" aria-hidden="true">
                    <ClipboardCheck className="h-5 w-5 text-brand-200" />
                  </span>
                  {d.fitness.checkedInToday ? <Pill tone="green">Done today</Pill> : <ArrowRight className="h-4 w-4 text-white/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-white/60">Daily check-in</span>
                  <span className="mt-0.5 block font-semibold">
                    {d.fitness.checkedInToday ? 'Checked in' : 'Log today in a minute'}
                  </span>
                  <span className="mt-0.5 block text-sm text-white/65">
                    {d.fitness.streak > 0 ? `${d.fitness.streak}-day streak` : 'Sleep, training, fuel and mood.'}
                  </span>
                </span>
              </Link>
            </div>
            {d.fitness.challenges.length > 0 && (
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Active challenges" data-testid="card-challenges">
                {d.fitness.challenges.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/fitness/challenges/${c.slug}`} className="vip-focus vip-surface flex h-full items-center gap-3 p-3.5 hover:bg-white/[0.04]">
                      <Trophy className="h-5 w-5 shrink-0 text-[#ead7a8]" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.title}</span>
                        <span className="block text-xs text-white/60">
                          {c.completed ? 'Completed' : c.joined ? `${(c.score ?? 0).toLocaleString('en-US')} of ${c.target.toLocaleString('en-US')}` : `${c.participants} taking part · join`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Community */}
          {!viewer.suspended && (
            <section aria-labelledby="community-h">
              <SectionHead
                id="community-h"
                title={d.postsSource === 'following' ? 'From people you follow' : 'Latest in the community'}
                href="/feed"
                linkLabel="Community"
              />
              {d.posts.length === 0 ? (
                <Link href="/feed" className="vip-focus vip-surface block p-5 text-sm text-white/70 hover:bg-white/[0.04]">
                  Start the conversation — share today’s training, a win from this week or a question.
                </Link>
              ) : (
                <ul className="vip-surface divide-y divide-white/[0.06] overflow-hidden">
                  {d.posts.map((p) => (
                    <li key={p.id}>
                      <Link href={`/posts/${p.id}`} className="vip-focus flex gap-3 p-4 hover:bg-white/[0.03]">
                        <Avatar name={p.author.displayName} src={p.author.avatarUrl} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 text-sm">
                            <span className="font-semibold">{p.author.displayName}</span>
                            {p.space && <span className="text-white/60"># {p.space.name}</span>}
                            <span className="text-xs text-white/60">{timeAgo(p.createdAt)}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-sm text-white/80">{p.body}</span>
                          <span className="mt-1.5 flex gap-4 text-xs text-white/60">
                            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden="true" /> {p.likes}</span>
                            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {p.comments}</span>
                            {p.photos > 0 && (
                              <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> {p.photos}</span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="events-h">
            <SectionHead id="events-h" title="Upcoming sessions" href="/events" linkLabel="Events" />
            {d.events.length === 0 ? (
              <p className="vip-surface p-4 text-sm text-white/65">New sessions post on the Events page first.</p>
            ) : (
              <ul className="space-y-2">
                {d.events.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events?event=${e.id}`} className="vip-focus vip-surface flex gap-3 p-3.5 hover:bg-white/[0.04]">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-center leading-none" aria-hidden="true">
                        <LocalDateBadge iso={e.startsAt} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{e.title}</span>
                        <span className="block text-xs text-white/60"><LocalTime iso={e.startsAt} /></span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          <Pill>{EVENT_KIND_LABEL[e.kind]}</Pill>
                          {e.going && <Pill tone="green">Going</Pill>}
                          {e.waitlisted && <Pill tone="amber">Waitlist #{e.waitlistPosition}</Pill>}
                          {!e.allowed && <TierBadge tier={e.minTier} />}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="rewards-h" className="vip-surface-strong vip-premium p-5">
            <div className="flex items-center gap-2">
              <Gift className="vip-gold h-5 w-5" aria-hidden="true" />
              <h2 id="rewards-h" className="font-semibold">Rewards</h2>
            </div>
            <p className="mt-3 text-3xl font-extrabold tabular-nums">{formatPoints(d.points)}</p>
            <p className="text-sm text-white/65">points · 100 points = $1</p>
            {d.rewards.length > 0 ? (
              <div className="mt-4" data-testid="card-rewards-catalog">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">From the rewards catalog</p>
                <ul className="mt-2 space-y-1.5">
                  {d.rewards.map((r) => (
                    <li key={r.id}>
                      <Link href="/rewards/catalog" className="vip-focus flex items-center justify-between gap-2 rounded-lg py-1 text-sm hover:text-white">
                        <span className="truncate text-white/80">{r.title}</span>
                        <span className={r.canAfford ? 'shrink-0 font-semibold text-emerald-200' : 'shrink-0 text-white/60'}>
                          {formatPoints(r.pointsCost)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : d.unlockable.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Unlock with points</p>
                <ul className="mt-2 space-y-1.5">
                  {d.unlockable.map((c) => (
                    <li key={c.id}>
                      <Link href={`/classroom/${c.slug}`} className="vip-focus flex items-center justify-between gap-2 rounded-lg py-1 text-sm hover:text-white">
                        <span className="truncate text-white/80">{c.title}</span>
                        <span className={d.points >= (c.pointsPrice ?? 0) ? 'shrink-0 font-semibold text-emerald-200' : 'shrink-0 text-white/60'}>
                          {formatPoints(c.pointsPrice ?? 0)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href="/rewards/catalog" className="vip-focus mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl text-sm font-semibold text-[#ead7a8] hover:text-white">
              Spend your points <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          <section aria-labelledby="progress-h" className="vip-surface p-5">
            <h2 id="progress-h" className="flex items-center gap-2 font-semibold">
              <Award className="h-5 w-5 text-brand-300" aria-hidden="true" /> Your progress
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-white/[0.04] p-3">
                <dt className="text-xs text-white/60">In progress</dt>
                <dd className="text-xl font-bold tabular-nums">{d.coursesInProgress}</dd>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-3">
                <dt className="text-xs text-white/60">Certificates</dt>
                <dd className="text-xl font-bold tabular-nums">{d.certificates}</dd>
              </div>
            </dl>
            <Link href="/classroom#certificates" className="vip-focus mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl text-sm font-medium text-brand-300 hover:text-brand-200">
              View certificates <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
