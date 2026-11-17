'use client'

import { MEASURE_OPTIONS } from '@/lib/vip/fitness/labels'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminInput } from './admin-vip-ui'

/**
 * Clubhouse admin — fitness, health & lifestyle forms (client components).
 * Same look and submit pattern as ./forms.tsx.
 */

type Tier = 'CLUB' | 'PLUS' | 'PREMIUM'
const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: 'CLUB', label: 'The Club and up' },
  { value: 'PLUS', label: 'Plus and up' },
  { value: 'PREMIUM', label: 'Premium Stacks only' },
]

const EX_API = '/api/admin/vip/fitness/exercises'
const PROG_API = '/api/admin/vip/fitness/programs'
const CH_API = '/api/admin/vip/fitness/challenges'
const ART_API = '/api/admin/vip/fitness/articles'

function useSubmit() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function send(endpoint: string, method: string, body: unknown, okText = 'Saved.') {
    setBusy(true)
    setMsg(null)
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setMsg({ ok: false, text: data.error || 'Failed' })
      return null
    }
    setMsg({ ok: true, text: okText })
    router.refresh()
    return data
  }
  return { busy, msg, send }
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return <p role="status" className={msg.ok ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>{msg.text}</p>
}

function Submit({ busy, children, small }: { busy: boolean; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl bg-brand-500 font-semibold text-white hover:bg-brand-600 disabled:opacity-50',
        small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

function Toggle({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">
      {open ? 'Close' : label}
    </button>
  )
}

const label = 'block text-sm text-white/60'
const toList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
const optInt = (s: string) => (s.trim() === '' ? null : Math.round(Number(s)))

// ─── Sub-navigation ────────────────────────────────────────────────────────

export function FitnessSubNav() {
  const pathname = usePathname() || ''
  const items = [
    { href: '/admin/vip/fitness', label: 'Overview', exact: true },
    { href: '/admin/vip/fitness/exercises', label: 'Exercises' },
    { href: '/admin/vip/fitness/programs', label: 'Programs' },
    { href: '/admin/vip/fitness/challenges', label: 'Challenges' },
    { href: '/admin/vip/fitness/articles', label: 'Lifestyle' },
  ]
  return (
    <nav className="mb-5 flex flex-wrap gap-1.5" aria-label="Fitness admin">
      {items.map((i) => {
        const on = i.exact ? pathname === i.href : pathname.startsWith(i.href)
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              on ? 'bg-brand-500/25 text-brand-100 ring-1 ring-inset ring-brand-400/40' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
            )}
          >
            {i.label}
          </Link>
        )
      })}
    </nav>
  )
}

// ─── Points settings ───────────────────────────────────────────────────────

export function PointsSettingsForm({ fields }: { fields: { key: string; label: string; value: number }[] }) {
  const { busy, msg, send } = useSubmit()
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.key, String(f.value)])))
  return (
    <form
      className="glass space-y-3 rounded-2xl p-5"
      onSubmit={(e) => {
        e.preventDefault()
        const body: Record<string, number> = {}
        for (const f of fields) body[f.key] = Math.max(0, Math.round(Number(values[f.key]) || 0))
        send('/api/admin/vip/fitness/settings', 'PUT', body)
      }}
    >
      <h2 className="font-semibold">Points</h2>
      <p className="text-sm text-white/40">Points members earn for training and health habits (100 points = $1). 0 = off.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className={label}>
            {f.label}
            <input
              className={`${adminInput} mt-1`}
              type="number"
              min={0}
              max={100000}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-white/40">Challenge points are set on each challenge.</p>
      <Msg msg={msg} />
      <Submit busy={busy}>Save points</Submit>
    </form>
  )
}

// ─── Exercises ─────────────────────────────────────────────────────────────

export interface AdminExercise {
  id: string
  name: string
  slug: string
  muscleGroups: string[]
  equipment: string[]
  measure: 'WEIGHT_REPS' | 'REPS' | 'TIME'
  instructions: string
  videoUrl: string | null
  imageUrl: string | null
  published: boolean
}


export function ExerciseForm({ exercise }: { exercise?: AdminExercise }) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(!exercise)
  const [name, setName] = useState(exercise?.name ?? '')
  const [slug, setSlug] = useState(exercise?.slug ?? '')
  const [muscles, setMuscles] = useState(exercise?.muscleGroups.join(', ') ?? '')
  const [equipment, setEquipment] = useState(exercise?.equipment.join(', ') ?? '')
  const [measure, setMeasure] = useState<AdminExercise['measure']>(exercise?.measure ?? 'WEIGHT_REPS')
  const [instructions, setInstructions] = useState(exercise?.instructions ?? '')
  const [videoUrl, setVideoUrl] = useState(exercise?.videoUrl ?? '')
  const [imageUrl, setImageUrl] = useState(exercise?.imageUrl ?? '')
  const [published, setPublished] = useState(exercise?.published ?? true)

  if (!open) return <Toggle open={false} onClick={() => setOpen(true)} label="Edit" />
  return (
    <form
      className={cn('space-y-3', exercise ? 'mt-3 w-full rounded-xl border border-white/10 p-4' : 'glass rounded-2xl p-5')}
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send(EX_API, 'POST', {
          op: 'exercise.upsert',
          id: exercise?.id,
          name,
          slug: slug || undefined,
          muscleGroups: toList(muscles),
          equipment: toList(equipment),
          measure,
          instructions,
          videoUrl,
          imageUrl,
          published,
        }, exercise ? 'Saved.' : 'Exercise added.')
        if (ok && !exercise) {
          setName('')
          setSlug('')
          setMuscles('')
          setEquipment('')
          setInstructions('')
          setVideoUrl('')
          setImageUrl('')
        }
      }}
    >
      {exercise ? (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Edit exercise</h3>
          <Toggle open onClick={() => setOpen(false)} label="Edit" />
        </div>
      ) : (
        <h2 className="font-semibold">New exercise</h2>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Name
          <input className={`${adminInput} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>
        <label className={label}>
          URL slug (optional)
          <input className={`${adminInput} mt-1`} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} />
        </label>
        <label className={label}>
          Muscle groups (comma-separated)
          <input className={`${adminInput} mt-1`} value={muscles} onChange={(e) => setMuscles(e.target.value)} placeholder="Chest, Triceps" />
        </label>
        <label className={label}>
          Equipment (comma-separated)
          <input className={`${adminInput} mt-1`} value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Barbell, Bench" />
        </label>
        <label className={label}>
          Logged as
          <select className={`${adminInput} mt-1`} value={measure} onChange={(e) => setMeasure(e.target.value as AdminExercise['measure'])}>
            {MEASURE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className={label}>
          Video URL (optional — YouTube/Vimeo embed)
          <input className={`${adminInput} mt-1`} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} maxLength={500} />
        </label>
      </div>
      <label className={label}>
        Image URL (optional, https)
        <input className={`${adminInput} mt-1`} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} maxLength={500} />
      </label>
      <label className={label}>
        Instructions — supports # headings, - lists, 1. lists, **bold**, *italic*, [link](https://…)
        <textarea className={`${adminInput} mt-1 font-mono`} rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={20000} />
      </label>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published (in the members&apos; library and the logger)
      </label>
      <Msg msg={msg} />
      <Submit busy={busy}>{exercise ? 'Save exercise' : 'Add exercise'}</Submit>
    </form>
  )
}

// ─── Programs ──────────────────────────────────────────────────────────────

export interface AdminProgram {
  id: string
  title: string
  slug: string
  summary: string | null
  description: string
  coverImage: string | null
  level: string | null
  minTier: Tier
  published: boolean
  sortOrder: number
}

export function ProgramForm({ program }: { program?: AdminProgram }) {
  const router = useRouter()
  const { busy, msg, send } = useSubmit()
  const [title, setTitle] = useState(program?.title ?? '')
  const [slug, setSlug] = useState(program?.slug ?? '')
  const [summary, setSummary] = useState(program?.summary ?? '')
  const [description, setDescription] = useState(program?.description ?? '')
  const [coverImage, setCoverImage] = useState(program?.coverImage ?? '')
  const [level, setLevel] = useState(program?.level ?? '')
  const [minTier, setMinTier] = useState<Tier>(program?.minTier ?? 'CLUB')
  const [published, setPublished] = useState(program?.published ?? false)
  const [sortOrder, setSortOrder] = useState(String(program?.sortOrder ?? 0))
  return (
    <form
      className="glass space-y-3 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const data = await send(PROG_API, 'POST', {
          op: 'program.upsert',
          id: program?.id,
          title,
          slug: slug || undefined,
          summary,
          description,
          coverImage,
          level,
          minTier,
          published,
          sortOrder: Number(sortOrder) || 0,
        })
        if (data && !program) router.push(`/admin/vip/fitness/programs/${data.id}`)
      }}
    >
      <h2 className="font-semibold">{program ? 'Program details' : 'New program'}</h2>
      <label className={label}>
        Title
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          URL slug (optional)
          <input className={`${adminInput} mt-1`} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} />
        </label>
        <label className={label}>
          Access
          <select className={`${adminInput} mt-1`} value={minTier} onChange={(e) => setMinTier(e.target.value as Tier)}>
            {TIER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className={label}>
          Level (optional)
          <input className={`${adminInput} mt-1`} value={level} onChange={(e) => setLevel(e.target.value)} maxLength={40} placeholder="Beginner" />
        </label>
        <label className={label}>
          Sort
          <input className={`${adminInput} mt-1`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
      </div>
      <label className={label}>
        Summary (optional, shown on the program card)
        <textarea className={`${adminInput} mt-1`} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
      </label>
      <label className={label}>
        Description — supports # headings, - lists, **bold**, *italic*, [link](https://…)
        <textarea className={`${adminInput} mt-1 font-mono`} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20000} />
      </label>
      <label className={label}>
        Cover image URL (optional, https)
        <input className={`${adminInput} mt-1`} value={coverImage} onChange={(e) => setCoverImage(e.target.value)} maxLength={500} />
      </label>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published (visible to members)
      </label>
      <Msg msg={msg} />
      <Submit busy={busy}>{program ? 'Save program' : 'Create program'}</Submit>
    </form>
  )
}

export function WeekForm({ programId, week }: { programId: string; week?: { id: string; weekNumber: number; title: string | null; notes: string | null } }) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(false)
  const [weekNumber, setWeekNumber] = useState(week ? String(week.weekNumber) : '')
  const [title, setTitle] = useState(week?.title ?? '')
  const [notes, setNotes] = useState(week?.notes ?? '')
  if (!open) return <Toggle open={false} onClick={() => setOpen(true)} label={week ? 'Edit week' : '+ Add week'} />
  return (
    <form
      className="mt-2 w-full space-y-2 rounded-xl border border-white/10 p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send(PROG_API, 'POST', {
          op: 'week.upsert',
          id: week?.id,
          programId,
          weekNumber: optInt(weekNumber) ?? undefined,
          title,
          notes,
        })
        if (ok) {
          setOpen(false)
          if (!week) {
            setTitle('')
            setNotes('')
            setWeekNumber('')
          }
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
        <label className={label}>
          Week #
          <input className={`${adminInput} mt-1`} type="number" min={1} max={104} value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} placeholder="next" />
        </label>
        <label className={label}>
          Title (optional)
          <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Build the base" />
        </label>
      </div>
      <label className={label}>
        Notes for the week (optional)
        <textarea className={`${adminInput} mt-1`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Submit busy={busy} small>{week ? 'Save week' : 'Add week'}</Submit>
        <Toggle open onClick={() => setOpen(false)} label="" />
        <Msg msg={msg} />
      </div>
    </form>
  )
}

export function DayForm({ weekId, day }: { weekId: string; day?: { id: string; dayNumber: number; title: string; notes: string | null; isRest: boolean } }) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(false)
  const [dayNumber, setDayNumber] = useState(day ? String(day.dayNumber) : '')
  const [title, setTitle] = useState(day?.title ?? '')
  const [notes, setNotes] = useState(day?.notes ?? '')
  const [isRest, setIsRest] = useState(day?.isRest ?? false)
  if (!open) return <Toggle open={false} onClick={() => setOpen(true)} label={day ? 'Edit day' : '+ Add day'} />
  return (
    <form
      className="mt-2 w-full space-y-2 rounded-xl border border-white/10 p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send(PROG_API, 'POST', {
          op: 'day.upsert',
          id: day?.id,
          weekId,
          dayNumber: optInt(dayNumber) ?? undefined,
          title,
          notes,
          isRest,
        })
        if (ok) {
          setOpen(false)
          if (!day) {
            setTitle('')
            setNotes('')
            setDayNumber('')
            setIsRest(false)
          }
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
        <label className={label}>
          Day #
          <input className={`${adminInput} mt-1`} type="number" min={1} max={14} value={dayNumber} onChange={(e) => setDayNumber(e.target.value)} placeholder="next" />
        </label>
        <label className={label}>
          Title
          <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="Lower body strength" />
        </label>
      </div>
      <label className={label}>
        Notes (optional)
        <textarea className={`${adminInput} mt-1`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
      </label>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={isRest} onChange={(e) => setIsRest(e.target.checked)} className="accent-brand-500" />
        Rest day (members mark it done with one tap)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Submit busy={busy} small>{day ? 'Save day' : 'Add day'}</Submit>
        <Toggle open onClick={() => setOpen(false)} label="" />
        <Msg msg={msg} />
      </div>
    </form>
  )
}

export function WorkoutForm({ dayId, workout }: { dayId: string; workout?: { id: string; title: string; notes: string | null; sortOrder: number } }) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(workout?.title ?? '')
  const [notes, setNotes] = useState(workout?.notes ?? '')
  const [sortOrder, setSortOrder] = useState(String(workout?.sortOrder ?? 0))
  if (!open) return <Toggle open={false} onClick={() => setOpen(true)} label={workout ? 'Edit workout' : '+ Add workout'} />
  return (
    <form
      className="mt-2 w-full space-y-2 rounded-xl border border-white/10 p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send(PROG_API, 'POST', {
          op: 'workout.upsert',
          id: workout?.id,
          dayId,
          title,
          notes,
          sortOrder: Number(sortOrder) || 0,
        })
        if (ok) {
          setOpen(false)
          if (!workout) {
            setTitle('')
            setNotes('')
          }
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <label className={label}>
          Workout title
          <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="Main session" />
        </label>
        <label className={label}>
          Sort
          <input className={`${adminInput} mt-1`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
      </div>
      <label className={label}>
        Notes (optional — warm-up, cues, intent)
        <textarea className={`${adminInput} mt-1`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Submit busy={busy} small>{workout ? 'Save workout' : 'Add workout'}</Submit>
        <Toggle open onClick={() => setOpen(false)} label="" />
        <Msg msg={msg} />
      </div>
    </form>
  )
}

export interface ExerciseOption {
  id: string
  name: string
  published: boolean
}

export function PrescriptionForm({
  workoutId,
  exercises,
  prescription,
}: {
  workoutId: string
  exercises: ExerciseOption[]
  prescription?: { id: string; exerciseId: string; sets: number; reps: string | null; durationSec: number | null; restSec: number | null; notes: string | null }
}) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(false)
  const [exerciseId, setExerciseId] = useState(prescription?.exerciseId ?? '')
  const [sets, setSets] = useState(String(prescription?.sets ?? 3))
  const [reps, setReps] = useState(prescription?.reps ?? '')
  const [durationSec, setDurationSec] = useState(prescription?.durationSec != null ? String(prescription.durationSec) : '')
  const [restSec, setRestSec] = useState(prescription?.restSec != null ? String(prescription.restSec) : '90')
  const [notes, setNotes] = useState(prescription?.notes ?? '')
  if (!open) return <Toggle open={false} onClick={() => setOpen(true)} label={prescription ? 'Edit' : '+ Add exercise'} />
  if (exercises.length === 0) {
    return (
      <p className="text-xs text-white/50">
        The exercise library is empty. <Link href="/admin/vip/fitness/exercises" className="text-brand-300 hover:underline">Add exercises</Link> first.
      </p>
    )
  }
  return (
    <form
      className="mt-2 w-full space-y-2 rounded-xl border border-white/10 p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send(PROG_API, 'POST', {
          op: 'prescription.upsert',
          id: prescription?.id,
          workoutId,
          exerciseId,
          sets: Math.max(1, Math.round(Number(sets) || 1)),
          reps,
          durationSec: optInt(durationSec),
          restSec: optInt(restSec),
          notes,
        })
        if (ok) {
          setOpen(false)
          if (!prescription) {
            setExerciseId('')
            setReps('')
            setDurationSec('')
            setNotes('')
          }
        }
      }}
    >
      <label className={label}>
        Exercise
        <select className={`${adminInput} mt-1`} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} required>
          <option value="">Choose an exercise…</option>
          {exercises.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}{x.published ? '' : ' (unpublished)'}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className={label}>
          Sets
          <input className={`${adminInput} mt-1`} type="number" min={1} max={20} value={sets} onChange={(e) => setSets(e.target.value)} required />
        </label>
        <label className={label}>
          Reps
          <input className={`${adminInput} mt-1`} value={reps} onChange={(e) => setReps(e.target.value)} maxLength={40} placeholder="8-10" />
        </label>
        <label className={label}>
          Time (sec)
          <input className={`${adminInput} mt-1`} type="number" min={1} value={durationSec} onChange={(e) => setDurationSec(e.target.value)} />
        </label>
        <label className={label}>
          Rest (sec)
          <input className={`${adminInput} mt-1`} type="number" min={0} max={1800} value={restSec} onChange={(e) => setRestSec(e.target.value)} />
        </label>
      </div>
      <label className={label}>
        Coaching notes (optional)
        <input className={`${adminInput} mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Controlled lowering, pause at the bottom" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Submit busy={busy} small>{prescription ? 'Save' : 'Add to workout'}</Submit>
        <Toggle open onClick={() => setOpen(false)} label="" />
        <Msg msg={msg} />
      </div>
    </form>
  )
}

// ─── Challenges ────────────────────────────────────────────────────────────

type Metric = 'WORKOUTS' | 'STEPS' | 'CHECKIN_STREAK' | 'CUSTOM_POINTS'

export interface AdminChallenge {
  id: string
  title: string
  slug: string
  description: string
  coverImage: string | null
  metric: Metric
  target: number
  startDate: string
  endDate: string
  minTier: Tier
  pointsReward: number
  badgeLabel: string | null
  published: boolean
}

export function ChallengeForm({
  challenge,
  metrics,
  metricLocked,
}: {
  challenge?: AdminChallenge
  metrics: { value: Metric; label: string }[]
  metricLocked?: boolean
}) {
  const router = useRouter()
  const { busy, msg, send } = useSubmit()
  const [title, setTitle] = useState(challenge?.title ?? '')
  const [slug, setSlug] = useState(challenge?.slug ?? '')
  const [description, setDescription] = useState(challenge?.description ?? '')
  const [coverImage, setCoverImage] = useState(challenge?.coverImage ?? '')
  const [metric, setMetric] = useState<Metric>(challenge?.metric ?? 'WORKOUTS')
  const [target, setTarget] = useState(String(challenge?.target ?? 12))
  const [startDate, setStartDate] = useState(challenge?.startDate ?? '')
  const [endDate, setEndDate] = useState(challenge?.endDate ?? '')
  const [minTier, setMinTier] = useState<Tier>(challenge?.minTier ?? 'CLUB')
  const [pointsReward, setPointsReward] = useState(String(challenge?.pointsReward ?? 0))
  const [badgeLabel, setBadgeLabel] = useState(challenge?.badgeLabel ?? '')
  const [published, setPublished] = useState(challenge?.published ?? false)
  return (
    <form
      className="glass space-y-3 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const data = await send(CH_API, 'POST', {
          op: 'challenge.upsert',
          id: challenge?.id,
          title,
          slug: slug || undefined,
          description,
          coverImage,
          metric,
          target: Math.max(1, Math.round(Number(target) || 1)),
          startDate,
          endDate,
          minTier,
          pointsReward: Math.max(0, Math.round(Number(pointsReward) || 0)),
          badgeLabel,
          published,
        })
        if (data && !challenge) router.push(`/admin/vip/fitness/challenges/${data.id}`)
      }}
    >
      <h2 className="font-semibold">{challenge ? 'Challenge details' : 'New challenge'}</h2>
      <label className={label}>
        Title
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          URL slug (optional)
          <input className={`${adminInput} mt-1`} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} />
        </label>
        <label className={label}>
          Access
          <select className={`${adminInput} mt-1`} value={minTier} onChange={(e) => setMinTier(e.target.value as Tier)}>
            {TIER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className={label}>
          Measured by
          <select
            className={`${adminInput} mt-1`}
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            disabled={metricLocked}
          >
            {metrics.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {metricLocked && <span className="mt-1 block text-xs text-white/40">Locked — members have joined.</span>}
        </label>
        <label className={label}>
          Target to complete
          <input className={`${adminInput} mt-1`} type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} required />
        </label>
        <label className={label}>
          Starts (member&apos;s local date)
          <input className={`${adminInput} mt-1`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label className={label}>
          Ends (inclusive)
          <input className={`${adminInput} mt-1`} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </label>
        <label className={label}>
          Points on completion (0 = none)
          <input className={`${adminInput} mt-1`} type="number" min={0} max={100000} value={pointsReward} onChange={(e) => setPointsReward(e.target.value)} />
        </label>
        <label className={label}>
          Badge label (optional — defaults to the title)
          <input className={`${adminInput} mt-1`} value={badgeLabel} onChange={(e) => setBadgeLabel(e.target.value)} maxLength={120} />
        </label>
      </div>
      <label className={label}>
        Description — supports # headings, - lists, **bold**, *italic*, [link](https://…)
        <textarea className={`${adminInput} mt-1 font-mono`} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20000} />
      </label>
      <label className={label}>
        Cover image URL (optional, https)
        <input className={`${adminInput} mt-1`} value={coverImage} onChange={(e) => setCoverImage(e.target.value)} maxLength={500} />
      </label>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published (members can see and join)
      </label>
      <Msg msg={msg} />
      <Submit busy={busy}>{challenge ? 'Save challenge' : 'Create challenge'}</Submit>
    </form>
  )
}

export function ScoreInput({ challengeId, userId, score }: { challengeId: string; userId: string; score: number }) {
  const { busy, msg, send } = useSubmit()
  const [value, setValue] = useState(String(score))
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        send(CH_API, 'POST', { op: 'participant.score', challengeId, userId, score: Math.max(0, Math.round(Number(value) || 0)) })
      }}
    >
      <input aria-label="Score" className={`${adminInput} w-24 py-1`} type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
      <Submit busy={busy} small>Set</Submit>
      <Msg msg={msg} />
    </form>
  )
}

// ─── Lifestyle articles ────────────────────────────────────────────────────

type Category = 'NUTRITION' | 'RECOVERY' | 'SLEEP' | 'MINDSET' | 'RECIPES'

export interface AdminArticle {
  id: string
  title: string
  slug: string
  summary: string | null
  coverImage: string | null
  body: string
  category: Category
  minTier: Tier
  published: boolean
}

export function ArticleForm({ article, categories }: { article?: AdminArticle; categories: { value: Category; label: string }[] }) {
  const router = useRouter()
  const { busy, msg, send } = useSubmit()
  const [title, setTitle] = useState(article?.title ?? '')
  const [slug, setSlug] = useState(article?.slug ?? '')
  const [summary, setSummary] = useState(article?.summary ?? '')
  const [coverImage, setCoverImage] = useState(article?.coverImage ?? '')
  const [body, setBody] = useState(article?.body ?? '')
  const [category, setCategory] = useState<Category>(article?.category ?? 'NUTRITION')
  const [minTier, setMinTier] = useState<Tier>(article?.minTier ?? 'CLUB')
  const [published, setPublished] = useState(article?.published ?? false)
  return (
    <form
      className="glass space-y-3 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const data = await send(ART_API, 'POST', {
          op: 'article.upsert',
          id: article?.id,
          title,
          slug: slug || undefined,
          summary,
          coverImage,
          body,
          category,
          minTier,
          published,
        })
        if (data && !article) router.push(`/admin/vip/fitness/articles/${data.id}`)
      }}
    >
      <h2 className="font-semibold">{article ? 'Edit article' : 'New article'}</h2>
      <label className={label}>
        Title
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Category
          <select className={`${adminInput} mt-1`} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className={label}>
          Access
          <select className={`${adminInput} mt-1`} value={minTier} onChange={(e) => setMinTier(e.target.value as Tier)}>
            {TIER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className={label}>
          URL slug (optional)
          <input className={`${adminInput} mt-1`} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} />
        </label>
      </div>
      <label className={label}>
        Summary (optional, shown on the card)
        <textarea className={`${adminInput} mt-1`} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={1000} />
      </label>
      <label className={label}>
        Cover image URL (optional, https)
        <input className={`${adminInput} mt-1`} value={coverImage} onChange={(e) => setCoverImage(e.target.value)} maxLength={500} />
      </label>
      {article && (
        <label className={label}>
          Body — supports # headings, - lists, 1. lists, **bold**, *italic*, [link](https://…)
          <textarea className={`${adminInput} mt-1 font-mono`} rows={16} value={body} onChange={(e) => setBody(e.target.value)} maxLength={100000} />
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published (visible to members)
      </label>
      <p className="text-xs text-white/40">
        Training, nutrition, sleep, recovery and mindset guidance only — no compound or medical advice, and no claims that anything treats a condition.
      </p>
      <Msg msg={msg} />
      <Submit busy={busy}>{article ? 'Save article' : 'Create and write'}</Submit>
    </form>
  )
}
