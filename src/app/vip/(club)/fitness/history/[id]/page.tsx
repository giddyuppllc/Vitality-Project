import { notFound, redirect } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { getFitnessPrefs } from '@/lib/vip/fitness/profile'
import { workoutSummary } from '@/lib/vip/fitness/workouts'
import { fmtDate } from '@/lib/vip/fitness/dates'
import { clock, fmtDuration, fmtNum, fmtVolume, fromKg, weightUnit, type Units } from '@/lib/vip/fitness/units'
import { prValue } from '@/lib/vip/fitness/format'
import { PR_LABEL } from '@/lib/vip/fitness/prs'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { BackLink, WellnessNote } from '@/components/vip/fitness/bits'
import { DeleteButton } from '@/components/vip/fitness/actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Workout summary' }

function setText(s: { weightKg: number | null; reps: number | null; durationSec: number | null }, u: Units) {
  if (s.durationSec) return `${clock(s.durationSec)}${s.weightKg ? ` · ${fmtNum(fromKg(s.weightKg, u))} ${weightUnit(u)}` : ''}`
  if (s.weightKg) return `${fmtNum(fromKg(s.weightKg, u))} ${weightUnit(u)} × ${s.reps ?? 0}`
  return `${s.reps ?? 0} reps`
}

export default async function WorkoutSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireVipPage('member')
  const { id } = await params
  const log = await prisma.vipWorkoutLog.findUnique({ where: { id } })
  // Someone else's workout is indistinguishable from a missing one.
  if (!log || log.userId !== viewer.userId) notFound()
  if (!log.finishedAt) redirect(`/fitness/workout/${id}`)
  const [summary, prefs, sets] = await Promise.all([
    workoutSummary(viewer.userId, id),
    getFitnessPrefs(viewer.userId),
    prisma.vipWorkoutSet.findMany({ where: { logId: id }, orderBy: { setNumber: 'asc' } }),
  ])
  const u = prefs.units

  return (
    <div className="mx-auto max-w-2xl">
      <FitnessTabs />
      <BackLink href="/fitness/history">History</BackLink>
      <article className="vip-surface-strong p-5 sm:p-7">
        <p className="vip-kicker">{fmtDate(summary.localDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <h1 className="mt-1 text-2xl font-bold">{summary.title}</h1>
        <dl className="mt-5 grid grid-cols-3 gap-2">
          {[
            ['Time', fmtDuration(summary.durationSec)],
            ['Sets', String(summary.totalSets)],
            ['Volume', fmtVolume(summary.totalVolumeKg, u)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.04] px-2 py-3 text-center">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{k}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {summary.pointsAwarded > 0 && <p className="vip-gold-soft mt-3 text-center text-sm">+{summary.pointsAwarded} points earned</p>}

        {summary.prs.length > 0 && (
          <section className="mt-6" aria-label="Personal records">
            <h2 className="flex items-center gap-2 font-semibold">
              <Trophy className="h-5 w-5 text-[#d4b26a]" aria-hidden="true" /> Records set
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {summary.prs.map((p, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                  <span>
                    <span className="font-medium">{p.exerciseName}</span> <span className="text-white/60">· {PR_LABEL[p.kind]}</span>
                  </span>
                  <span className="tabular-nums">{prValue(p.kind, p.value, u)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 space-y-4">
          {summary.exercises.map((e) => (
            <section key={e.id}>
              <h2 className="font-semibold">{e.name}</h2>
              <ol className="mt-1.5 space-y-1">
                {sets
                  .filter((s) => s.exerciseId === e.id)
                  .map((s) => (
                    <li key={s.id} className="flex items-baseline gap-3 text-sm">
                      <span className="w-12 text-white/55">Set {s.setNumber}</span>
                      <span className="font-medium tabular-nums">{setText(s, u)}</span>
                      {s.rpe && <span className="text-xs text-white/55">RPE {fmtNum(s.rpe)}</span>}
                    </li>
                  ))}
              </ol>
            </section>
          ))}
        </div>
        {log.notes && (
          <p className="mt-6 whitespace-pre-line rounded-xl bg-white/[0.03] p-3 text-sm text-white/75">{log.notes}</p>
        )}
      </article>
      <div className="mt-4">
        <DeleteButton
          url={`/api/vip/fitness/workouts/${id}`}
          label="Delete this workout"
          confirmText="Delete this workout from your history? Your records are recalculated from the workouts that remain."
          redirectTo="/fitness/history"
        />
      </div>
      <WellnessNote />
    </div>
  )
}
