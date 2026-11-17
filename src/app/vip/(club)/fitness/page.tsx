import Link from 'next/link'
import { ArrowRight, CalendarCheck, Flame, Moon, Trophy } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getFitnessPrefs, todayIn } from '@/lib/vip/fitness/profile'
import { getTodaysWorkout } from '@/lib/vip/fitness/programs'
import { findOpenWorkout, personalRecords } from '@/lib/vip/fitness/workouts'
import { streakInfo, weeklySummary } from '@/lib/vip/fitness/health'
import { listChallenges, METRIC_LABEL } from '@/lib/vip/fitness/challenges'
import { FIT_COPY } from '@/lib/vip/fitness/copy'
import { fmtDuration, fmtNum } from '@/lib/vip/fitness/units'
import { PR_LABEL, type PrKind } from '@/lib/vip/fitness/prs'
import { PageHeader } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { LockedNotice, SectionTitle, WellnessNote } from '@/components/vip/fitness/bits'
import { ProgramAction, StartWorkoutButton } from '@/components/vip/fitness/actions'
import { prValue } from '@/lib/vip/fitness/format'
import { Stat } from '@/components/vip/fitness/charts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Fitness' }

export default async function FitnessTodayPage() {
  const viewer = await requireVipPage('member')
  const prefs = await getFitnessPrefs(viewer.userId)
  const today = todayIn(prefs.timeZone)
  const [plan, open, streak, week, challenges, prs] = await Promise.all([
    getTodaysWorkout(viewer.userId, viewer.accessTier),
    findOpenWorkout(viewer.userId),
    streakInfo(viewer.userId, today),
    weeklySummary(viewer.userId, today),
    listChallenges(viewer.userId, viewer.accessTier, today),
    personalRecords(viewer.userId),
  ])
  const myChallenges = challenges.filter((c) => c.joined && c.status === 'active')
  const day = plan?.day

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={FIT_COPY.hub.title} intro={FIT_COPY.hub.intro} />
      <FitnessTabs />

      {open && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] p-4">
          <p className="text-sm">
            <span className="font-semibold">Workout in progress:</span> {open.title}
          </p>
          <Link href={`/fitness/workout/${open.id}`} className="vip-focus inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold hover:bg-brand-600">
            Resume <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="vip-surface-strong p-5" aria-labelledby="today-h">
          <p className="vip-kicker">Today&apos;s workout</p>
          {!plan ? (
            <>
              <h2 id="today-h" className="mt-1 text-xl font-bold">No program running</h2>
              <p className="mt-1.5 text-sm text-white/65">Pick a program and your next session waits here every day. Or log whatever you&apos;re doing today.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/fitness/programs" className="vip-focus inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-medium hover:bg-white/[0.06]">
                  Browse programs
                </Link>
                <StartWorkoutButton label="Start an empty workout" />
              </div>
            </>
          ) : !day ? (
            <>
              <h2 id="today-h" className="mt-1 text-xl font-bold">{plan.program.title}</h2>
              <p className="mt-1.5 text-sm text-white/65">Every day of this program is done.</p>
            </>
          ) : (
            <>
              <h2 id="today-h" className="mt-1 text-xl font-bold">{day.title}</h2>
              <p className="mt-0.5 text-sm text-white/60">
                <Link href={`/fitness/programs/${plan.program.slug}`} className="hover:text-white">
                  {plan.program.title}
                </Link>{' '}
                · Week {plan.position!.week} · Session {plan.position!.index} of {plan.position!.total}
              </p>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={plan.totalDays}
                aria-valuenow={plan.completedDays}
                aria-label="Program progress"
              >
                <div className="h-full rounded-full bg-brand-400" style={{ width: `${(plan.completedDays / Math.max(1, plan.totalDays)) * 100}%` }} />
              </div>
              {!plan.allowed ? (
                <div className="mt-4">
                  <LockedNotice minTier={plan.program.minTier} what="program" />
                </div>
              ) : day.isRest ? (
                <div className="mt-4">
                  <p className="flex items-center gap-2 text-sm text-white/75">
                    <Moon className="h-4 w-4 text-brand-300" aria-hidden="true" /> Rest day. {day.notes || 'Recovery is part of the plan.'}
                  </p>
                  <div className="mt-4">
                    <ProgramAction programId={plan.program.id} action="rest-day" dayId={day.id} label="Mark rest day done" full />
                  </div>
                </div>
              ) : (
                <>
                  {day.notes && <p className="mt-3 text-sm text-white/70">{day.notes}</p>}
                  <ul className="mt-4 space-y-2">
                    {day.workouts.flatMap((w) =>
                      w.prescriptions.map((p) => (
                        <li key={p.id} className="flex items-baseline justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm">
                          <span className="font-medium">{p.exercise.name}</span>
                          <span className="shrink-0 tabular-nums text-white/65">
                            {p.sets} × {p.durationSec ? fmtDuration(p.durationSec) : p.reps || '—'}
                          </span>
                        </li>
                      )),
                    )}
                  </ul>
                  <div className="mt-4">
                    <StartWorkoutButton programDayId={day.id} label="Start this workout" full />
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <div className="space-y-4">
          <section className="vip-surface p-5" aria-labelledby="checkin-h">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="vip-kicker">Daily check-in</p>
                <h2 id="checkin-h" className="mt-1 flex items-center gap-2 text-xl font-bold">
                  <Flame className="h-5 w-5 text-[#d4b26a]" aria-hidden="true" />
                  {streak.current} day{streak.current === 1 ? '' : 's'}
                </h2>
                <p className="text-sm text-white/60">current streak · best {streak.best}</p>
              </div>
              <CalendarCheck className={streak.checkedInToday ? 'h-6 w-6 text-emerald-300' : 'h-6 w-6 text-white/30'} aria-hidden="true" />
            </div>
            <Link
              href="/fitness/health"
              className={
                streak.checkedInToday
                  ? 'vip-focus mt-4 flex min-h-11 items-center justify-center rounded-xl border border-white/15 text-sm font-medium hover:bg-white/[0.06]'
                  : 'vip-focus mt-4 flex min-h-11 items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold hover:bg-brand-600'
              }
            >
              {streak.checkedInToday ? 'Checked in today · edit' : 'Check in for today'}
            </Link>
          </section>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Workouts" value={String(week.workouts)} sub="last 7 days" />
            <Stat label="Check-ins" value={`${week.checkinDays}/7`} sub="last 7 days" />
          </div>
        </div>
      </div>

      {myChallenges.length > 0 && (
        <>
          <SectionTitle action={<Link href="/fitness/challenges" className="text-sm text-brand-300 hover:text-brand-200">All challenges</Link>}>Your challenges</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {myChallenges.map((c) => {
              const pct = Math.min(100, Math.round(((c.score ?? 0) / c.target) * 100))
              return (
                <li key={c.id}>
                  <Link href={`/fitness/challenges/${c.slug}`} className="vip-surface vip-focus block p-4 hover:bg-white/[0.04]">
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-0.5 text-sm text-white/60">
                      {fmtNum(c.score ?? 0, 0)} / {fmtNum(c.target, 0)} {METRIC_LABEL[c.metric].unit(c.target)}
                      {c.completed && ' · complete'}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${c.title} progress`}>
                      <div className={c.completed ? 'h-full rounded-full bg-emerald-300' : 'h-full rounded-full bg-brand-400'} style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {prs.length > 0 && (
        <>
          <SectionTitle action={<Link href="/fitness/history" className="text-sm text-brand-300 hover:text-brand-200">History</Link>}>Recent records</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            {prs.slice(0, 4).map((r) => (
              <li key={r.id} className="vip-surface flex items-center gap-3 p-3.5">
                <Trophy className="h-5 w-5 shrink-0 text-[#d4b26a]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.exercise.name}</p>
                  <p className="text-xs text-white/60">{PR_LABEL[r.kind as PrKind]}</p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{prValue(r.kind as PrKind, r.value, prefs.units)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {plan && (
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-white/60">
          <span>Something different today?</span>
          <StartWorkoutButton label="Start an empty workout" className="min-h-10 border border-white/15 bg-transparent hover:bg-white/[0.06]" />
        </div>
      )}
      <WellnessNote />
    </div>
  )
}

