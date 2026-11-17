import Link from 'next/link'
import { ChevronRight, Trophy } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getFitnessPrefs, todayIn } from '@/lib/vip/fitness/profile'
import { listHistory, personalRecords, weeklyTotals } from '@/lib/vip/fitness/workouts'
import { FIT_COPY } from '@/lib/vip/fitness/copy'
import { fmtDate } from '@/lib/vip/fitness/dates'
import { fmtDuration, fmtNum, fmtVolume, fromKg, weightUnit } from '@/lib/vip/fitness/units'
import { prValue } from '@/lib/vip/fitness/format'
import { PR_LABEL, type PrKind } from '@/lib/vip/fitness/prs'
import { EmptyState, PageHeader } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { SectionTitle, WellnessNote } from '@/components/vip/fitness/bits'
import { BarChart } from '@/components/vip/fitness/charts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'History' }

export default async function HistoryPage() {
  const viewer = await requireVipPage('member')
  const prefs = await getFitnessPrefs(viewer.userId)
  const today = todayIn(prefs.timeZone)
  const [logs, weeks, records] = await Promise.all([
    listHistory(viewer.userId, 60),
    weeklyTotals(viewer.userId, today, 12),
    personalRecords(viewer.userId),
  ])
  const u = prefs.units
  const wk = (d: string) => fmtDate(d, { month: 'short', day: 'numeric' })

  // One best record per exercise for the list (e1RM for loaded lifts, else reps/time).
  const byExercise = new Map<string, (typeof records)[number]>()
  const rank: Record<string, number> = { EST_1RM: 0, MAX_WEIGHT: 1, MAX_REPS: 2, MAX_DURATION: 3, BEST_SET_VOLUME: 4 }
  for (const r of records) {
    const cur = byExercise.get(r.exerciseId)
    if (!cur || rank[r.kind] < rank[cur.kind]) byExercise.set(r.exerciseId, r)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={FIT_COPY.history.title} intro={FIT_COPY.history.intro} />
      <FitnessTabs />
      {logs.length === 0 ? (
        <EmptyState title={FIT_COPY.history.empty.title}>{FIT_COPY.history.empty.body}</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="vip-surface p-4 sm:p-5">
              <h2 className="text-sm font-semibold">Workouts per week</h2>
              <p className="mb-2 text-xs text-white/55">Last 12 weeks</p>
              <BarChart caption="Workouts per week, last 12 weeks" data={weeks.map((w) => ({ label: wk(w.week), value: w.workouts, display: `${w.workouts} ${w.workouts === 1 ? 'workout' : 'workouts'}` }))} />
            </section>
            <section className="vip-surface p-4 sm:p-5">
              <h2 className="text-sm font-semibold">Volume per week ({weightUnit(u)})</h2>
              <p className="mb-2 text-xs text-white/55">Weight × reps, all lifts</p>
              <BarChart caption={`Training volume per week in ${weightUnit(u)}, last 12 weeks`} data={weeks.map((w) => ({ label: wk(w.week), value: fromKg(w.volumeKg, u), display: fmtVolume(w.volumeKg, u) }))} />
            </section>
          </div>

          {byExercise.size > 0 && (
            <>
              <SectionTitle>Personal records</SectionTitle>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[...byExercise.values()].map((r) => (
                  <li key={r.id}>
                    <Link href={`/fitness/exercises/${r.exercise.slug}`} className="vip-surface vip-focus flex items-center gap-3 p-3.5 hover:bg-white/[0.04]">
                      <Trophy className="h-5 w-5 shrink-0 text-[#d4b26a]" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.exercise.name}</span>
                        <span className="block text-xs text-white/60">{PR_LABEL[r.kind as PrKind]}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{prValue(r.kind as PrKind, r.value, u)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <SectionTitle>Workouts</SectionTitle>
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id}>
                <Link href={`/fitness/history/${l.id}`} className="vip-surface vip-focus flex items-center gap-3 p-4 hover:bg-white/[0.04]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{l.title}</span>
                    <span className="block text-sm text-white/60">
                      {l.localDate ? fmtDate(l.localDate) : ''} · {fmtDuration(l.durationSec)} · {l.totalSets} sets
                      {l.totalVolumeKg > 0 && ` · ${fmtNum(Math.round(fromKg(l.totalVolumeKg, u)), 0)} ${weightUnit(u)}`}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-white/40" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <WellnessNote />
    </div>
  )
}
