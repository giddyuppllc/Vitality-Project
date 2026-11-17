import Link from 'next/link'
import { Search } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { exerciseFacets, listExercises } from '@/lib/vip/fitness/exercises'
import { FIT_COPY } from '@/lib/vip/fitness/copy'
import { cn } from '@/lib/utils'
import { EmptyState, PageHeader } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { WellnessNote } from '@/components/vip/fitness/bits'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exercise library' }

const MEASURE: Record<string, string> = { WEIGHT_REPS: 'Weight × reps', REPS: 'Bodyweight', TIME: 'Timed' }

function href(params: { q?: string; muscle?: string; equipment?: string }) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `/fitness/exercises?${s}` : '/fitness/exercises'
}

function Chips({ label, items, active, build }: { label: string; items: string[]; active?: string; build: (v?: string) => string }) {
  if (items.length === 0) return null
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
          <li>
            <Link href={build(undefined)} aria-current={!active ? 'true' : undefined} className={cn('vip-focus inline-flex h-9 items-center rounded-full border px-3 text-sm', !active ? 'border-brand-400/40 bg-brand-500/20 text-white' : 'border-white/10 text-white/65 hover:text-white')}>
              All
            </Link>
          </li>
          {items.map((m) => (
            <li key={m}>
              <Link
                href={build(m)}
                aria-current={active === m ? 'true' : undefined}
                className={cn('vip-focus inline-flex h-9 items-center rounded-full border px-3 text-sm', active === m ? 'border-brand-400/40 bg-brand-500/20 text-white' : 'border-white/10 text-white/65 hover:text-white')}
              >
                {m}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireVipPage('member')
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined)
  const q = one(sp.q)
  const muscle = one(sp.muscle)
  const equipment = one(sp.equipment)
  const [items, facets] = await Promise.all([listExercises({ q, muscle, equipment }), exerciseFacets()])
  const libraryEmpty = facets.muscles.length === 0 && facets.equipment.length === 0 && items.length === 0 && !q

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={FIT_COPY.exercises.title} intro={FIT_COPY.exercises.intro} />
      <FitnessTabs />
      {libraryEmpty ? (
        <EmptyState title={FIT_COPY.exercises.emptyLibrary.title}>{FIT_COPY.exercises.emptyLibrary.body}</EmptyState>
      ) : (
        <>
          <form action="/fitness/exercises" method="get" role="search" className="flex gap-2">
            {muscle && <input type="hidden" name="muscle" value={muscle} />}
            {equipment && <input type="hidden" name="equipment" value={equipment} />}
            <label className="relative flex-1">
              <span className="sr-only">Search exercises</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" aria-hidden="true" />
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search by name"
                className="vip-focus h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-base text-white placeholder:text-white/45"
              />
            </label>
            <button type="submit" className="vip-focus h-12 rounded-xl bg-brand-500 px-4 text-sm font-semibold hover:bg-brand-600">
              Search
            </button>
          </form>
          <Chips label="Muscle group" items={facets.muscles} active={muscle} build={(m) => href({ q, muscle: m, equipment })} />
          <Chips label="Equipment" items={facets.equipment} active={equipment} build={(e) => href({ q, muscle, equipment: e })} />

          <p className="mt-5 text-sm text-white/55" aria-live="polite">
            {items.length} {items.length === 1 ? 'exercise' : 'exercises'}
          </p>
          {items.length === 0 ? (
            <div className="mt-3">
              <EmptyState title={FIT_COPY.exercises.empty.title}>
                {FIT_COPY.exercises.empty.body}{' '}
                <Link href="/fitness/exercises" className="font-semibold text-brand-300 hover:text-brand-200">
                  Clear filters
                </Link>
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {items.map((e) => (
                <li key={e.id}>
                  <Link href={`/fitness/exercises/${e.slug}`} className="vip-surface vip-focus flex min-h-[4.5rem] items-center gap-3 p-3 hover:bg-white/[0.04]">
                    {e.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin-entered image URL
                      <img src={e.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-900/70 to-dark-700 text-lg font-bold text-white/80" aria-hidden="true">
                        {e.name[0]}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{e.name}</span>
                      <span className="block truncate text-xs text-white/55">
                        {[e.muscleGroups.join(', '), e.equipment.join(', ') || MEASURE[e.measure]].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <WellnessNote />
    </div>
  )
}
