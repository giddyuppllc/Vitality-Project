import type { Prisma } from '@prisma/client'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { AdminActionButton, adminInput } from '@/components/admin/vip/admin-vip-ui'
import { ExerciseForm, FitnessSubNav, MEASURE_OPTIONS } from '@/components/admin/vip/fitness-forms'

export const dynamic = 'force-dynamic'

const API = '/api/admin/vip/fitness/exercises'

export default async function AdminVipExercisesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage()
  const { q: rawQ } = await searchParams
  const q = (rawQ ?? '').trim().slice(0, 80)
  const where: Prisma.VipExerciseWhereInput = q ? { name: { contains: q, mode: 'insensitive' } } : {}
  const [exercises, total] = await Promise.all([
    prisma.vipExercise.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 500,
      include: { _count: { select: { prescriptions: true, sets: true } } },
    }),
    prisma.vipExercise.count(),
  ])
  const measureLabel = (m: string) => MEASURE_OPTIONS.find((o) => o.value === m)?.label ?? m

  return (
    <div>
      <FitnessSubNav />
      <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
        <section className="glass min-w-0 rounded-2xl p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Exercise library</h2>
              <p className="text-sm text-white/40">{total} exercises. Unpublished ones stay in members&apos; history but can&apos;t be picked.</p>
            </div>
            <form method="get" role="search" className="flex gap-2">
              <label className="sr-only" htmlFor="ex-q">Search exercises</label>
              <input id="ex-q" name="q" type="search" defaultValue={q} placeholder="Search by name" className={`${adminInput} w-48`} />
              <button type="submit" className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10">Search</button>
            </form>
          </div>
          {exercises.length === 0 ? (
            <p className="text-sm text-white/40">{q ? `No exercises match "${q}".` : 'No exercises yet. Add the first one with the form.'}</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {exercises.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {e.name}{' '}
                        {!e.published && <span className="ml-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] text-amber-200">unpublished</span>}
                      </p>
                      <p className="text-xs text-white/40">
                        {measureLabel(e.measure)}
                        {e.muscleGroups.length > 0 && ` · ${e.muscleGroups.join(', ')}`}
                        {e.equipment.length > 0 && ` · ${e.equipment.join(', ')}`}
                        {e.videoUrl && ' · video'}
                        {` · in ${e._count.prescriptions} program slot${e._count.prescriptions === 1 ? '' : 's'} · ${e._count.sets} logged set${e._count.sets === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <AdminActionButton
                      endpoint={API}
                      tone="danger"
                      label="Delete"
                      confirmText={`Delete "${e.name}" permanently?`}
                      body={{ op: 'exercise.delete', id: e.id }}
                    />
                  </div>
                  <ExerciseForm
                    exercise={{
                      id: e.id,
                      name: e.name,
                      slug: e.slug,
                      muscleGroups: e.muscleGroups,
                      equipment: e.equipment,
                      measure: e.measure,
                      instructions: e.instructions,
                      videoUrl: e.videoUrl,
                      imageUrl: e.imageUrl,
                      published: e.published,
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <div>
          <ExerciseForm />
        </div>
      </div>
    </div>
  )
}
