import { notFound, redirect } from 'next/navigation'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getFitnessPrefs } from '@/lib/vip/fitness/profile'
import { getWorkoutForLogger } from '@/lib/vip/fitness/workouts'
import { WorkoutLogger } from '@/components/vip/fitness/logger'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Workout' }

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireVipPage('member')
  const { id } = await params
  // Only the member's own workout; anyone else's id is a plain 404.
  const data = await getWorkoutForLogger(viewer.userId, id).catch(() => null)
  if (!data) notFound()
  if (data.log.finishedAt) redirect(`/fitness/history/${id}`)
  const prefs = await getFitnessPrefs(viewer.userId)
  return (
    <WorkoutLogger
      logId={data.log.id}
      initialTitle={data.log.title}
      initialNotes={data.log.notes}
      startedAt={data.log.startedAt.toISOString()}
      units={prefs.units}
      fromProgram={!!data.log.programDayId}
      initialBlocks={data.blocks.map((b) => ({
        exercise: { id: b.exercise.id, slug: b.exercise.slug, name: b.exercise.name, measure: b.exercise.measure, muscleGroups: b.exercise.muscleGroups },
        plan: b.plan,
        sets: b.sets.map((s) => ({ id: s.id, exerciseId: s.exerciseId, setNumber: s.setNumber, weightKg: s.weightKg, reps: s.reps, durationSec: s.durationSec, rpe: s.rpe })),
        previous: b.previous,
      }))}
    />
  )
}
