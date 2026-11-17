import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getExercise } from '@/lib/vip/fitness/exercises'
import { exerciseProgress, personalRecords } from '@/lib/vip/fitness/workouts'
import { getFitnessPrefs } from '@/lib/vip/fitness/profile'
import { renderLessonMarkdown } from '@/lib/vip/text'
import { prValue } from '@/lib/vip/fitness/format'
import { PR_LABEL, type PrKind } from '@/lib/vip/fitness/prs'
import { fmtDate } from '@/lib/vip/fitness/dates'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { BackLink, SectionTitle, Tag, VideoBlock, WellnessNote } from '@/components/vip/fitness/bits'
import { LineChart } from '@/components/vip/fitness/charts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exercise' }

const MEASURE: Record<string, string> = { WEIGHT_REPS: 'Weight × reps', REPS: 'Bodyweight reps', TIME: 'Timed' }
const CHART_LABEL: Record<string, string> = { EST_1RM: 'Estimated 1-rep max per session', MAX_REPS: 'Best set (reps) per session', MAX_DURATION: 'Longest set per session' }

export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireVipPage('member')
  const { slug } = await params
  const ex = await getExercise(slug)
  if (!ex) notFound()
  const [prefs, records, progress] = await Promise.all([
    getFitnessPrefs(viewer.userId),
    personalRecords(viewer.userId, ex.id),
    exerciseProgress(viewer.userId, ex.id, ex.measure),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <FitnessTabs />
      <BackLink href="/fitness/exercises">Exercise library</BackLink>
      <article className="vip-surface-strong p-5 sm:p-7">
        <h1 className="text-2xl font-bold">{ex.name}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ex.muscleGroups.map((m) => (
            <Link key={m} href={`/fitness/exercises?muscle=${encodeURIComponent(m)}`} className="vip-focus rounded-full">
              <Tag>{m}</Tag>
            </Link>
          ))}
          {ex.equipment.map((m) => (
            <Link key={m} href={`/fitness/exercises?equipment=${encodeURIComponent(m)}`} className="vip-focus rounded-full">
              <Tag>{m}</Tag>
            </Link>
          ))}
          <Tag>{MEASURE[ex.measure]}</Tag>
        </div>
        {ex.videoUrl ? (
          <div className="mt-5">
            <VideoBlock url={ex.videoUrl} title={ex.name} />
          </div>
        ) : ex.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-entered image URL
          <img src={ex.imageUrl} alt={ex.name} className="mt-5 max-h-96 w-full rounded-xl object-cover" />
        ) : null}
        {ex.instructions.trim() ? (
          <div className="vip-prose mt-5" dangerouslySetInnerHTML={{ __html: renderLessonMarkdown(ex.instructions) }} />
        ) : (
          <p className="mt-5 text-sm text-white/60">Ask a coach in the community if you want form tips on this one.</p>
        )}
      </article>

      <SectionTitle>Your records</SectionTitle>
      {records.length === 0 ? (
        <p className="vip-surface p-5 text-sm text-white/60">Log this exercise in a workout and your best numbers show up here.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-3">
          {records.map((r) => (
            <li key={r.id} className="vip-surface p-4">
              <p className="flex items-center gap-1.5 text-xs text-white/60">
                <Trophy className="h-3.5 w-3.5 text-[#d4b26a]" aria-hidden="true" /> {PR_LABEL[r.kind as PrKind]}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">{prValue(r.kind as PrKind, r.value, prefs.units)}</p>
              <p className="text-xs text-white/55">{r.achievedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: prefs.timeZone })}</p>
            </li>
          ))}
        </ul>
      )}

      {progress.points.length >= 2 && (
        <section className="vip-surface mt-4 p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold">{CHART_LABEL[progress.kind]}</h3>
          <LineChart
            caption={CHART_LABEL[progress.kind]}
            data={progress.points.map((p) => ({ label: fmtDate(p.date, { month: 'short', day: 'numeric' }), value: p.best, display: prValue(progress.kind, p.best, prefs.units) }))}
          />
        </section>
      )}
      <WellnessNote />
    </div>
  )
}
