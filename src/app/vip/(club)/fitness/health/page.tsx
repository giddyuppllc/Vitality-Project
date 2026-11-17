import { Flame, Lock } from 'lucide-react'
import type { VipCheckin } from '@prisma/client'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getFitnessPrefs, todayIn } from '@/lib/vip/fitness/profile'
import { listBodyMetrics, recentCheckins, streakInfo, weeklySummary } from '@/lib/vip/fitness/health'
import { listProgressPhotos } from '@/lib/vip/fitness/photos'
import { addDays, fmtDate } from '@/lib/vip/fitness/dates'
import { fmtNum, fromCm, fromKg, fromMl, lengthUnit, waterUnit, weightUnit, type Units } from '@/lib/vip/fitness/units'
import { FIT_COPY } from '@/lib/vip/fitness/copy'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { SectionTitle, WellnessNote } from '@/components/vip/fitness/bits'
import { DeleteButton, UnitsToggle } from '@/components/vip/fitness/actions'
import { CheckinForm, MetricsForm, PhotoUpload, type CheckinValues } from '@/components/vip/fitness/health-forms'
import { LineChart, Stat } from '@/components/vip/fitness/charts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Health' }

function toValues(c: VipCheckin | null, u: Units): CheckinValues | null {
  if (!c) return null
  return {
    water: c.waterMl != null ? fromMl(c.waterMl, u) : null,
    sleepHours: c.sleepHours,
    steps: c.steps,
    mood: c.mood,
    energy: c.energy,
    workoutDone: c.workoutDone,
    notes: c.notes,
  }
}

const one = (n: number | null, dp = 1) => (n == null ? '—' : fmtNum(n, dp))

export default async function HealthPage() {
  const viewer = await requireVipPage('member')
  const prefs = await getFitnessPrefs(viewer.userId)
  const u = prefs.units
  const today = todayIn(prefs.timeZone)
  const [grid, streak, week, metrics, photos] = await Promise.all([
    recentCheckins(viewer.userId, today, 28),
    streakInfo(viewer.userId, today),
    weeklySummary(viewer.userId, today),
    listBodyMetrics(viewer.userId),
    listProgressPhotos(viewer.userId),
  ])
  const todayC = grid.find((g) => g.date === today)?.checkin ?? null
  const yesterdayC = grid.find((g) => g.date === addDays(today, -1))?.checkin ?? null
  const weights = metrics.filter((m) => m.weightKg != null).reverse()

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={FIT_COPY.health.title} intro={FIT_COPY.health.intro}>
        <UnitsToggle units={u} />
      </PageHeader>
      <FitnessTabs />
      <p className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">
        <Lock className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" /> {FIT_COPY.health.privacy}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="vip-surface-strong p-5" aria-labelledby="ci-h">
          <h2 id="ci-h" className="mb-4 text-lg font-semibold">
            Daily check-in
          </h2>
          <CheckinForm units={u} today={toValues(todayC, u)} yesterday={toValues(yesterdayC, u)} />
        </section>

        <div className="space-y-4">
          <section className="vip-surface p-5" aria-labelledby="streak-h">
            <div className="flex items-center justify-between gap-3">
              <h2 id="streak-h" className="flex items-center gap-2 text-lg font-semibold">
                <Flame className="h-5 w-5 text-[#d4b26a]" aria-hidden="true" /> {streak.current}-day streak
              </h2>
              <span className="text-sm text-white/60">Best {streak.best}</span>
            </div>
            <p className="mt-1 text-xs text-white/55">Check in 7 days in a row for a streak bonus.</p>
            <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Check-ins, last 28 days">
              {grid.map((g) => (
                <li
                  key={g.date}
                  title={`${fmtDate(g.date)}: ${g.checkin ? 'checked in' : 'no check-in'}`}
                  className={cn(
                    'grid aspect-square place-items-center rounded-lg text-[11px] tabular-nums',
                    g.checkin ? 'bg-brand-500/70 text-white' : 'bg-white/[0.05] text-white/45',
                    g.date === today && 'ring-2 ring-brand-300/70',
                  )}
                >
                  <span className="sr-only">
                    {fmtDate(g.date)}: {g.checkin ? 'checked in' : 'no check-in'}
                  </span>
                  <span aria-hidden="true">{Number(g.date.slice(8))}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="week-h">
            <h2 id="week-h" className="mb-2 text-sm font-semibold text-white/80">
              Last 7 days
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Avg sleep" value={week.avgSleep == null ? '—' : `${one(week.avgSleep)} h`} />
              <Stat label="Avg water" value={week.avgWaterMl == null ? '—' : `${fmtNum(fromMl(week.avgWaterMl, u), 0)} ${waterUnit(u)}`} />
              <Stat label="Steps" value={week.totalSteps == null ? '—' : fmtNum(week.totalSteps, 0)} sub={week.avgSteps == null ? undefined : `${fmtNum(week.avgSteps, 0)} a day`} />
              <Stat label="Workouts" value={String(week.workouts)} sub={`${week.checkinDays}/7 check-ins`} />
              <Stat label="Mood" value={week.avgMood == null ? '—' : `${one(week.avgMood)} / 5`} />
              <Stat label="Energy" value={week.avgEnergy == null ? '—' : `${one(week.avgEnergy)} / 5`} />
            </div>
          </section>
        </div>
      </div>

      <SectionTitle>Body measurements</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="vip-surface min-w-0 p-5" aria-label="Add measurements">
          <MetricsForm units={u} today={today} />
        </section>
        <section className="vip-surface min-w-0 p-5" aria-label="Measurement history">
          {weights.length >= 2 && (
            <div className="mb-4">
              <h3 className="mb-1 text-sm font-semibold">Weight ({weightUnit(u)})</h3>
              <LineChart
                caption={`Body weight in ${weightUnit(u)}`}
                data={weights.map((m) => ({ label: fmtDate(m.date, { month: 'short', day: 'numeric' }), value: fromKg(m.weightKg!, u), display: `${fmtNum(fromKg(m.weightKg!, u))} ${weightUnit(u)}` }))}
              />
            </div>
          )}
          {metrics.length === 0 ? (
            <p className="text-sm text-white/60">No measurements yet. Weekly is plenty — same time of day, same conditions.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/55">
                    <th className="px-1 py-1.5 font-medium">Date</th>
                    <th className="px-1 py-1.5 font-medium">Weight</th>
                    <th className="px-1 py-1.5 font-medium">Body fat</th>
                    <th className="px-1 py-1.5 font-medium">Waist</th>
                    <th className="px-1 py-1.5">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {metrics.slice(0, 20).map((m) => (
                    <tr key={m.id}>
                      <td className="px-1 py-1 text-white/75">{fmtDate(m.date, { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                      <td className="px-1 py-1 tabular-nums">{m.weightKg != null ? `${fmtNum(fromKg(m.weightKg, u))} ${weightUnit(u)}` : '—'}</td>
                      <td className="px-1 py-1 tabular-nums">{m.bodyFatPct != null ? `${fmtNum(m.bodyFatPct)}%` : '—'}</td>
                      <td className="px-1 py-1 tabular-nums">{m.waistCm != null ? `${fmtNum(fromCm(m.waistCm, u))} ${lengthUnit(u)}` : '—'}</td>
                      <td className="px-1 py-1 text-right">
                        <DeleteButton compact url={`/api/vip/fitness/metrics/${m.id}`} label={`Delete the ${fmtDate(m.date)} entry`} confirmText="Delete this entry?" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <SectionTitle>Progress photos</SectionTitle>
      <section className="vip-surface p-5" aria-label="Progress photos">
        <p className="mb-3 text-sm text-white/65">Only you can open these — they&apos;re stored privately and location data is removed from every photo.</p>
        <PhotoUpload today={today} />
        {photos.length === 0 ? (
          <p className="mt-4 text-sm text-white/55">No photos yet. Same spot, same light, every few weeks makes the comparison honest.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => (
              <li key={p.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <a href={`/api/vip/fitness/photos/${p.id}`} target="_blank" rel="noopener" className="vip-focus block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- owner-only image route */}
                  <img src={`/api/vip/fitness/photos/${p.id}`} alt={`Progress photo, ${p.pose ?? 'photo'}, ${fmtDate(p.date)}`} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                </a>
                <div className="flex items-center justify-between gap-1 px-2 py-1">
                  <span className="truncate text-[11px] text-white/65">
                    {fmtDate(p.date, { month: 'short', day: 'numeric' })}
                    {p.pose ? ` · ${p.pose}` : ''}
                  </span>
                  <DeleteButton compact url={`/api/vip/fitness/photos/${p.id}`} label="Delete photo" confirmText="Delete this photo for good?" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <WellnessNote />
    </div>
  )
}
