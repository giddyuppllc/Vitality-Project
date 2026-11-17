import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Circle, Moon } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getProgram, orderedDays } from '@/lib/vip/fitness/programs'
import { renderLessonMarkdown } from '@/lib/vip/text'
import { fmtDuration } from '@/lib/vip/fitness/units'
import { TierBadge } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { BackLink, LockedNotice, Tag, WellnessNote } from '@/components/vip/fitness/bits'
import { ProgramAction, StartWorkoutButton } from '@/components/vip/fitness/actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Program' }

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireVipPage('member')
  const { slug } = await params
  const data = await getProgram(slug, viewer.userId, viewer.accessTier)
  if (!data) notFound()
  const { program, allowed, enrollment, done, nextDayId, totalDays } = data
  const days = orderedDays(program)
  const next = days.find((d) => d.id === nextDayId) ?? null
  const status = enrollment?.status ?? null
  const completed = days.filter((d) => done.has(d.id)).length

  return (
    <div className="mx-auto max-w-3xl">
      <FitnessTabs />
      <BackLink href="/fitness/programs">All programs</BackLink>
      <article className="vip-surface-strong overflow-hidden">
        {program.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
          <img src={program.coverImage} alt="" className="h-44 w-full object-cover sm:h-56" />
        )}
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-1.5">
            {program.level && <Tag>{program.level}</Tag>}
            <Tag>
              {program.weeks.length} {program.weeks.length === 1 ? 'week' : 'weeks'} · {days.filter((d) => !d.isRest).length} sessions
            </Tag>
            {program.minTier !== 'CLUB' && <TierBadge tier={program.minTier} />}
          </div>
          <h1 className="mt-2 text-2xl font-bold sm:text-[28px]">{program.title}</h1>
          {program.summary && <p className="mt-2 text-[15px] leading-relaxed text-white/70">{program.summary}</p>}

          <div className="mt-5">
            {!allowed ? (
              <LockedNotice minTier={program.minTier} what="program" />
            ) : totalDays === 0 ? (
              <p className="text-sm text-white/60">The coaching team is still writing this program&apos;s sessions.</p>
            ) : status === null ? (
              <ProgramAction programId={program.id} action="enroll" label="Start this program" />
            ) : status === 'PAUSED' ? (
              <div className="flex flex-wrap items-center gap-3">
                <ProgramAction programId={program.id} action="enroll" label="Resume program" />
                <span className="text-sm text-white/60">
                  Paused at {completed} of {totalDays} days
                </span>
              </div>
            ) : status === 'COMPLETED' ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Completed
                </span>
                <ProgramAction programId={program.id} action="restart" label="Start again from day one" ghost confirmText="Start this program again from day one? Your logged workouts stay in your history." />
              </div>
            ) : (
              <div className="rounded-xl border border-brand-400/25 bg-brand-500/[0.08] p-4">
                <p className="text-sm text-white/65">
                  {completed} of {totalDays} days done
                </p>
                {next && (
                  <>
                    <p className="mt-1 font-semibold">
                      Up next: Week {next.weekNumber} · {next.title}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {next.isRest ? (
                        <ProgramAction programId={program.id} action="rest-day" dayId={next.id} label="Mark rest day done" />
                      ) : (
                        <StartWorkoutButton programDayId={next.id} label="Start this workout" />
                      )}
                      <ProgramAction programId={program.id} action="pause" label="Pause program" ghost />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {allowed && program.description.trim() && <div className="vip-prose mt-6" dangerouslySetInnerHTML={{ __html: renderLessonMarkdown(program.description) }} />}
        </div>
      </article>

      <h2 className="mb-3 mt-8 text-lg font-semibold">The plan</h2>
      <div className="space-y-3">
        {program.weeks.map((w) => {
          const weekDone = w.days.length > 0 && w.days.every((d) => done.has(d.id))
          const isCurrent = next ? w.days.some((d) => d.id === next.id) : w.weekNumber === 1
          return (
            <details key={w.id} open={isCurrent} className="vip-surface group">
              <summary className="vip-focus flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] px-5 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="font-semibold">Week {w.weekNumber}</span>
                  {w.title && <span className="text-white/65"> · {w.title}</span>}
                </span>
                <span className="text-xs text-white/55">
                  {weekDone ? 'Done' : `${w.days.filter((d) => done.has(d.id)).length}/${w.days.length}`}
                </span>
              </summary>
              <div className="border-t border-white/[0.07] px-5 pb-4 pt-2">
                {w.notes && <p className="mb-2 text-sm text-white/65">{w.notes}</p>}
                <ol className="space-y-2">
                  {w.days.map((d) => (
                    <li key={d.id} className="rounded-xl bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2">
                        {done.has(d.id) ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-label="Done" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-white/30" aria-hidden="true" />
                        )}
                        <p className="text-sm font-medium">
                          Day {d.dayNumber} · {d.title}
                        </p>
                        {d.isRest && (
                          <span className="ml-auto inline-flex items-center gap-1 text-xs text-white/55">
                            <Moon className="h-3.5 w-3.5" aria-hidden="true" /> Rest
                          </span>
                        )}
                      </div>
                      {allowed && !d.isRest && d.workouts.length > 0 && (
                        <div className="mt-2 space-y-2 pl-6">
                          {d.notes && <p className="text-sm text-white/60">{d.notes}</p>}
                          {d.workouts.map((wk) => (
                            <div key={wk.id}>
                              {d.workouts.length > 1 && <p className="text-xs font-semibold uppercase tracking-wider text-white/55">{wk.title}</p>}
                              <ul className="mt-1 space-y-1">
                                {wk.prescriptions.map((p) => (
                                  <li key={p.id} className="flex items-baseline justify-between gap-3 text-sm">
                                    {p.exercise.published ? (
                                      <Link href={`/fitness/exercises/${p.exercise.slug}`} className="text-white/85 hover:text-white hover:underline">
                                        {p.exercise.name}
                                      </Link>
                                    ) : (
                                      <span className="text-white/85">{p.exercise.name}</span>
                                    )}
                                    <span className="shrink-0 tabular-nums text-white/60">
                                      {p.sets} × {p.durationSec ? fmtDuration(p.durationSec) : p.reps || '—'}
                                      {p.restSec ? ` · rest ${fmtDuration(p.restSec)}` : ''}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          )
        })}
      </div>
      <WellnessNote />
    </div>
  )
}
