'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Minus, Pencil, Plus, Search, Timer, Trash2, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clock, fmtDuration, fmtNum, fmtVolume, fromKg, weightUnit, type Units } from '@/lib/vip/fitness/units'
import { PR_LABEL, type PrKind } from '@/lib/vip/fitness/prs'
import { prValue } from '@/lib/vip/fitness/format'
import { api, browserTz, ErrorText } from './actions'
import { btnGhost, btnPrimary } from './styles'

type Measure = 'WEIGHT_REPS' | 'REPS' | 'TIME'

export interface LoggerSet {
  id: string
  exerciseId: string
  setNumber: number
  weightKg: number | null
  reps: number | null
  durationSec: number | null
  rpe: number | null
}

export interface LoggerBlock {
  exercise: { id: string; slug: string; name: string; measure: Measure; muscleGroups: string[] }
  plan: { sets: number; reps: string | null; durationSec: number | null; restSec: number | null; notes: string | null }[]
  sets: LoggerSet[]
  previous: { weightKg: number | null; reps: number | null; durationSec: number | null }[]
}

interface Summary {
  logId: string
  title: string
  durationSec: number
  totalSets: number
  totalVolumeKg: number
  exercises: { id: string; name: string; sets: number }[]
  prs: { kind: PrKind; value: number; previous: number | null; exerciseName: string; measure: Measure }[]
  pointsAwarded: number
  programCompleted: boolean
  programPoints: number
  challengesCompleted: { title: string; points: number }[]
}

const DEFAULT_REST = 90

function firstInt(s: string | null | undefined): number | null {
  const m = /\d+/.exec(s ?? '')
  return m ? Number(m[0]) : null
}

function setText(s: Pick<LoggerSet, 'weightKg' | 'reps' | 'durationSec'>, measure: Measure, units: Units) {
  if (measure === 'TIME') return `${clock(s.durationSec ?? 0)}${s.weightKg ? ` · ${fmtNum(fromKg(s.weightKg, units))} ${weightUnit(units)}` : ''}`
  if (s.weightKg) return `${fmtNum(fromKg(s.weightKg, units))} ${weightUnit(units)} × ${s.reps ?? 0}`
  return `${s.reps ?? 0} reps`
}

function Stepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  suffix,
  inputMode = 'decimal',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  step: number
  min?: number
  suffix?: string
  inputMode?: 'decimal' | 'numeric'
}) {
  const n = Number(value) || 0
  const bump = (d: number) => onChange(String(Math.max(min, Math.round((n + d) * 100) / 100)))
  return (
    <div className="min-w-0 flex-1">
      <span className="mb-1 block text-xs font-medium text-white/60">{label}</span>
      <div className="flex h-14 items-stretch overflow-hidden rounded-xl border border-white/12 bg-white/[0.04]">
        <button type="button" onClick={() => bump(-step)} className="vip-focus grid w-10 shrink-0 place-items-center text-white/75 active:bg-white/10" aria-label={`Decrease ${label}`}>
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
        <label className="relative flex min-w-0 flex-1 items-center justify-center">
          <span className="sr-only">{label}</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
            inputMode={inputMode}
            enterKeyHint="done"
            className={cn('vip-focus w-full min-w-0 bg-transparent text-center font-bold tabular-nums text-white outline-none', value.length > 4 ? 'text-lg' : 'text-xl')}
          />
          {suffix && <span className="pointer-events-none pr-1 text-xs text-white/50">{suffix}</span>}
        </label>
        <button type="button" onClick={() => bump(step)} className="vip-focus grid w-10 shrink-0 place-items-center text-white/75 active:bg-white/10" aria-label={`Increase ${label}`}>
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function BlockCard({
  block,
  units,
  logId,
  onChange,
  onRest,
  onRemove,
}: {
  block: LoggerBlock
  units: Units
  logId: string
  onChange: (sets: LoggerSet[]) => void
  onRest: (sec: number) => void
  onRemove: () => void
}) {
  const { exercise, plan, sets, previous } = block
  const measure = exercise.measure
  const target = plan[0]
  const planSets = plan.reduce((a, p) => a + p.sets, 0)
  const next = sets.length
  const last = sets[sets.length - 1]
  const prevSame = previous[next] ?? previous[previous.length - 1]
  const seed = last ?? prevSame ?? null
  const wStep = units === 'METRIC' ? 2.5 : 5

  const [weight, setWeight] = useState(seed?.weightKg ? String(fromKg(seed.weightKg, units)) : '')
  // Weight carries over from this session / last time; reps and time follow the coach's target first.
  const [reps, setReps] = useState(String(last?.reps ?? firstInt(target?.reps) ?? prevSame?.reps ?? ''))
  const [secs, setSecs] = useState(String(last?.durationSec ?? target?.durationSec ?? prevSame?.durationSec ?? ''))
  const [rpe, setRpe] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const done = planSets > 0 && sets.length >= planSets

  async function logSet() {
    setBusy(true)
    setError(null)
    const r = await api<{ set: LoggerSet }>(`/api/vip/fitness/workouts/${logId}/sets`, 'POST', {
      exerciseId: exercise.id,
      units,
      weight: measure === 'REPS' && !weight ? null : weight ? Number(weight) : null,
      reps: measure === 'TIME' ? null : Number(reps) || null,
      durationSec: measure === 'TIME' ? Number(secs) || null : null,
      rpe: rpe ? Number(rpe) : null,
    })
    setBusy(false)
    if (!r.ok) {
      setError(r.data.error || 'Could not save the set.')
      return
    }
    onChange([...sets, r.data.set])
    setRpe('')
    onRest(target?.restSec ?? DEFAULT_REST)
  }

  async function removeSet(id: string) {
    const r = await api(`/api/vip/fitness/workouts/${logId}/sets/${id}`, 'DELETE')
    if (r.ok) {
      const rest = sets.filter((s) => s.id !== id).map((s, i) => ({ ...s, setNumber: i + 1 }))
      onChange(rest)
    } else setError(r.data.error || 'Could not delete the set.')
  }

  async function saveEdit(s: LoggerSet, form: { weight: string; reps: string; secs: string; rpe: string }) {
    const r = await api<{ set: LoggerSet }>(`/api/vip/fitness/workouts/${logId}/sets/${s.id}`, 'PATCH', {
      units,
      weight: form.weight ? Number(form.weight) : null,
      reps: measure === 'TIME' ? null : Number(form.reps) || null,
      durationSec: measure === 'TIME' ? Number(form.secs) || null : null,
      rpe: form.rpe ? Number(form.rpe) : null,
    })
    if (r.ok) {
      onChange(sets.map((x) => (x.id === s.id ? r.data.set : x)))
      setEditing(null)
    } else setError(r.data.error || 'Could not save the change.')
  }

  return (
    <section className="vip-surface p-4" aria-labelledby={`ex-${exercise.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`ex-${exercise.id}`} className="text-[17px] font-semibold leading-snug">
            {exercise.name}
          </h2>
          {plan.length > 0 && (
            <p className="mt-0.5 text-sm text-white/65">
              Target{' '}
              {plan
                .map((p) => `${p.sets} × ${p.durationSec ? fmtDuration(p.durationSec) : p.reps || '—'}`)
                .join(', ')}
              {target?.restSec ? ` · rest ${fmtDuration(target.restSec)}` : ''}
            </p>
          )}
          {plan.find((p) => p.notes) && <p className="mt-1 text-sm text-white/55">{plan.find((p) => p.notes)?.notes}</p>}
          {previous.length > 0 && (
            <p className="mt-1 text-xs text-white/55">Last time: {previous.map((p) => setText(p, measure, units)).join(', ')}</p>
          )}
        </div>
        <details className="relative shrink-0">
          <summary className="vip-focus grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg text-white/55 hover:bg-white/[0.06] [&::-webkit-details-marker]:hidden" aria-label={`Options for ${exercise.name}`}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-white/10 bg-[#0f1729] p-1 text-sm shadow-xl">
            <Link href={`/fitness/exercises/${exercise.slug}`} target="_blank" className="block rounded-lg px-3 py-2 text-white/80 hover:bg-white/[0.06]">
              How to do it
            </Link>
            <button
              type="button"
              onClick={() => {
                if (sets.length === 0 || window.confirm(`Remove ${exercise.name} and its ${sets.length} logged set(s)?`)) onRemove()
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-red-200 hover:bg-red-500/10"
            >
              Remove from workout
            </button>
          </div>
        </details>
      </div>

      {sets.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {sets.map((s) =>
            editing === s.id ? (
              <EditRow key={s.id} set={s} measure={measure} units={units} onCancel={() => setEditing(null)} onSave={(f) => saveEdit(s, f)} />
            ) : (
              <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] py-1.5 pl-3 pr-1">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-300/15 text-emerald-200" aria-hidden="true">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="w-12 shrink-0 text-xs text-white/55">Set {s.setNumber}</span>
                <span className="min-w-0 flex-1 font-semibold tabular-nums">{setText(s, measure, units)}</span>
                {s.rpe && <span className="text-xs text-white/55">RPE {fmtNum(s.rpe)}</span>}
                <button type="button" onClick={() => setEditing(s.id)} className="vip-focus grid h-10 w-10 place-items-center rounded-lg text-white/55 hover:bg-white/[0.06]" aria-label={`Edit set ${s.setNumber}`}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => removeSet(s.id)} className="vip-focus grid h-10 w-10 place-items-center rounded-lg text-white/55 hover:bg-red-500/10 hover:text-red-200" aria-label={`Delete set ${s.setNumber}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ),
          )}
        </ol>
      )}

      <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
          Set {next + 1}
          {planSets > 0 && <span className="ml-1 normal-case tracking-normal text-white/45">of {planSets}{done ? ' — target reached' : ''}</span>}
        </p>
        <div className="flex gap-2">
          {measure !== 'TIME' && (
            <Stepper label={measure === 'REPS' ? `Added weight (${weightUnit(units)})` : `Weight (${weightUnit(units)})`} value={weight} onChange={setWeight} step={wStep} />
          )}
          {measure === 'TIME' ? (
            <Stepper label="Time (seconds)" value={secs} onChange={setSecs} step={15} inputMode="numeric" suffix={secs ? clock(Number(secs)) : undefined} />
          ) : (
            <Stepper label="Reps" value={reps} onChange={setReps} step={1} inputMode="numeric" />
          )}
        </div>
        <div className="mt-2 flex items-end gap-2">
          <label className="w-28 shrink-0 text-xs font-medium text-white/60">
            Effort (RPE)
            <select value={rpe} onChange={(e) => setRpe(e.target.value)} className="vip-focus mt-1 h-14 w-full rounded-xl border border-white/12 bg-[#0f1729] px-2 text-base text-white">
              <option value="">—</option>
              {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={logSet} disabled={busy} className={cn(btnPrimary, 'h-14 flex-1 text-base')}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Check className="h-5 w-5" aria-hidden="true" />}
            Log set
          </button>
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    </section>
  )
}

function EditRow({
  set,
  measure,
  units,
  onCancel,
  onSave,
}: {
  set: LoggerSet
  measure: Measure
  units: Units
  onCancel: () => void
  onSave: (f: { weight: string; reps: string; secs: string; rpe: string }) => void
}) {
  const [weight, setWeight] = useState(set.weightKg ? String(fromKg(set.weightKg, units)) : '')
  const [reps, setReps] = useState(String(set.reps ?? ''))
  const [secs, setSecs] = useState(String(set.durationSec ?? ''))
  const [rpe, setRpe] = useState(set.rpe ? String(set.rpe) : '')
  const field = 'vip-focus h-11 w-full rounded-lg border border-white/12 bg-white/[0.05] px-2 text-center text-base tabular-nums text-white'
  return (
    <li className="rounded-xl border border-brand-400/30 bg-brand-500/[0.07] p-2">
      <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
        {measure !== 'TIME' && (
          <label>
            {weightUnit(units)}
            <input className={field} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
        )}
        {measure === 'TIME' ? (
          <label>
            Seconds
            <input className={field} inputMode="numeric" value={secs} onChange={(e) => setSecs(e.target.value)} />
          </label>
        ) : (
          <label>
            Reps
            <input className={field} inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
          </label>
        )}
        <label>
          RPE
          <input className={field} inputMode="decimal" value={rpe} onChange={(e) => setRpe(e.target.value)} />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className={cn(btnPrimary, 'flex-1')} onClick={() => onSave({ weight, reps, secs, rpe })}>
          Save set {set.setNumber}
        </button>
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </li>
  )
}

function RestTimer({ endsAt, total, onAdjust, onClose }: { endsAt: number; total: number; onAdjust: (d: number) => void; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const fired = useRef(false)
  useEffect(() => {
    fired.current = false
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [endsAt])
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000))
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true
      try {
        navigator.vibrate?.([200, 100, 200])
      } catch {}
    }
  }, [left])
  const pct = total > 0 ? Math.min(100, ((total - left) / total) * 100) : 100
  return (
    <div className="fixed inset-x-0 z-40 px-3 lg:bottom-6" style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}>
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-white/12 bg-[#0f1729]/95 shadow-2xl backdrop-blur-xl lg:ml-[calc(50%-8rem)]">
        <div className="h-1 bg-white/[0.08]">
          <div className="h-full bg-brand-400 transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-2 p-2.5">
          <Timer className="ml-1 h-5 w-5 shrink-0 text-brand-300" aria-hidden="true" />
          <p className="min-w-0 flex-1" aria-live="polite">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{left === 0 ? 'Rest done' : 'Rest'}</span>
            <span className={cn('text-2xl font-bold tabular-nums', left === 0 && 'text-emerald-200')}>{clock(left)}</span>
          </p>
          <button type="button" onClick={() => onAdjust(-15)} className="vip-focus h-12 rounded-xl border border-white/12 px-3 text-sm font-semibold tabular-nums" aria-label="15 seconds less">
            −15
          </button>
          <button type="button" onClick={() => onAdjust(15)} className="vip-focus h-12 rounded-xl border border-white/12 px-3 text-sm font-semibold tabular-nums" aria-label="15 seconds more">
            +15
          </button>
          <button type="button" onClick={onClose} className="vip-focus grid h-12 w-12 place-items-center rounded-xl bg-white/[0.06]" aria-label={left === 0 ? 'Close rest timer' : 'Skip rest'}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ExercisePicker({ exclude, onPick, onClose }: { exclude: string[]; onPick: (e: LoggerBlock['exercise']) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<LoggerBlock['exercise'][] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api<{ exercises: LoggerBlock['exercise'][] }>(`/api/vip/fitness/exercises?q=${encodeURIComponent(q)}`, 'GET')
      setItems(r.ok ? r.data.exercises : [])
    }, 200)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const list = (items ?? []).filter((e) => !exclude.includes(e.id))
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Add an exercise" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[#0b1220] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/[0.07] p-3">
          <label className="relative flex-1">
            <span className="sr-only">Search exercises</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" aria-hidden="true" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search exercises"
              type="search"
              className="vip-focus h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-base text-white placeholder:text-white/45"
            />
          </label>
          <button type="button" onClick={onClose} className="vip-focus grid h-12 w-12 place-items-center rounded-xl bg-white/[0.06]" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
          {items === null ? (
            <li className="p-4 text-center text-sm text-white/55">Loading…</li>
          ) : list.length === 0 ? (
            <li className="p-4 text-center text-sm text-white/55">No exercises match.</li>
          ) : (
            list.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onPick(e)} className="vip-focus flex min-h-14 w-full flex-col justify-center rounded-xl px-3 py-2 text-left hover:bg-white/[0.05]">
                  <span className="font-medium">{e.name}</span>
                  {e.muscleGroups.length > 0 && <span className="text-xs text-white/55">{e.muscleGroups.join(' · ')}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

function SummaryView({ s, units }: { s: Summary; units: Units }) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="vip-surface-strong p-5 text-center sm:p-7">
        <p className="vip-kicker">Workout complete</p>
        <h1 className="mt-1 text-2xl font-bold">{s.title}</h1>
        <dl className="mt-5 grid grid-cols-3 gap-2">
          {[
            ['Time', fmtDuration(s.durationSec)],
            ['Sets', String(s.totalSets)],
            ['Volume', fmtVolume(s.totalVolumeKg, units)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.04] px-2 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{k}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {(s.pointsAwarded > 0 || s.programPoints > 0 || s.challengesCompleted.length > 0) && (
          <ul className="mt-4 space-y-1 text-sm">
            {s.pointsAwarded > 0 && <li className="vip-gold-soft">+{s.pointsAwarded} points for today&apos;s workout</li>}
            {s.programCompleted && <li className="vip-gold-soft">Program complete{s.programPoints ? ` — +${s.programPoints} points` : ''}</li>}
            {s.challengesCompleted.map((c) => (
              <li key={c.title} className="vip-gold-soft">
                Challenge complete: {c.title}
                {c.points ? ` — +${c.points} points` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
      {s.prs.length > 0 && (
        <section className="vip-surface mt-4 p-5" aria-label="Personal records">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="h-5 w-5 text-[#d4b26a]" aria-hidden="true" /> Personal records
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {s.prs.map((p, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <span>
                  <span className="font-semibold">{p.exerciseName}</span> <span className="text-white/60">· {PR_LABEL[p.kind]}</span>
                </span>
                <span className="tabular-nums">
                  {prValue(p.kind, p.value, units)}
                  <span className="ml-1 text-xs text-white/55">{p.previous == null ? 'first log' : `was ${prValue(p.kind, p.previous, units)}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/fitness" className={btnPrimary}>
          Back to Today
        </Link>
        <Link href="/fitness/health" className={btnGhost}>
          Do today&apos;s check-in
        </Link>
        <Link href="/fitness/history" className={btnGhost}>
          See history
        </Link>
      </div>
    </div>
  )
}

export function WorkoutLogger({
  logId,
  initialTitle,
  initialNotes,
  startedAt,
  initialBlocks,
  units,
  fromProgram,
}: {
  logId: string
  initialTitle: string
  initialNotes: string | null
  startedAt: string
  initialBlocks: LoggerBlock[]
  units: Units
  fromProgram: boolean
}) {
  const router = useRouter()
  const [blocks, setBlocks] = useState(initialBlocks)
  const [title, setTitle] = useState(initialTitle)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [picker, setPicker] = useState(false)
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  const totalSets = useMemo(() => blocks.reduce((a, b) => a + b.sets.length, 0), [blocks])

  const startRest = useCallback((sec: number) => {
    if (sec > 0) setRest({ endsAt: Date.now() + sec * 1000, total: sec })
  }, [])

  async function addExercise(e: LoggerBlock['exercise']) {
    setPicker(false)
    const r = await api(`/api/vip/fitness/workouts/${logId}/exercises`, 'POST', { exerciseId: e.id })
    if (r.ok) setBlocks((b) => [...b, { exercise: e, plan: [], sets: [], previous: [] }])
    else setError(r.data.error || 'Could not add that exercise.')
  }

  async function removeExercise(id: string) {
    const r = await api(`/api/vip/fitness/workouts/${logId}/exercises`, 'DELETE', { exerciseId: id })
    if (r.ok) setBlocks((b) => b.filter((x) => x.exercise.id !== id))
    else setError(r.data.error || 'Could not remove that exercise.')
  }

  async function finish() {
    const planned = blocks.reduce((a, b) => a + b.plan.reduce((x, p) => x + p.sets, 0), 0)
    if (planned > totalSets && !window.confirm(`You've logged ${totalSets} of ${planned} planned sets. Finish anyway?`)) return
    setFinishing(true)
    setError(null)
    const r = await api<Summary>(`/api/vip/fitness/workouts/${logId}/finish`, 'POST', { tz: browserTz() })
    setFinishing(false)
    if (!r.ok) {
      setError(r.data.error || 'Could not finish the workout.')
      return
    }
    setRest(null)
    setSummary(r.data)
    window.scrollTo({ top: 0 })
  }

  async function discard() {
    if (!window.confirm('Discard this workout? Every set you logged in it is deleted.')) return
    const r = await api(`/api/vip/fitness/workouts/${logId}`, 'DELETE')
    if (r.ok) {
      router.push('/fitness')
      router.refresh()
    } else setError(r.data.error || 'Could not discard the workout.')
  }

  async function saveMeta(data: { title?: string; notes?: string }) {
    await api(`/api/vip/fitness/workouts/${logId}`, 'PATCH', data)
  }

  if (summary) return <SummaryView s={summary} units={units} />

  return (
    <div className="mx-auto max-w-xl">
      <div className="sticky top-16 z-30 -mx-4 mb-4 border-b border-white/[0.07] bg-[#070b14]/90 px-4 py-2.5 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <label className="block">
              <span className="sr-only">Workout name</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && saveMeta({ title })}
                maxLength={160}
                className="vip-focus w-full truncate rounded-md bg-transparent text-[15px] font-semibold text-white"
              />
            </label>
            <p className="text-xs tabular-nums text-white/60" aria-live="off">
              {clock(elapsed)} · {totalSets} {totalSets === 1 ? 'set' : 'sets'}
            </p>
          </div>
          <button type="button" onClick={finish} disabled={finishing || totalSets === 0} className={cn(btnPrimary, 'h-11 bg-emerald-600 px-5 hover:bg-emerald-500')}>
            {finishing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Finish
          </button>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      {blocks.length === 0 && (
        <div className="vip-surface px-5 py-8 text-center">
          <p className="font-semibold">Add your first exercise</p>
          <p className="mt-1 text-sm text-white/60">Pick from the library, then log each set as you finish it. Every set saves the moment you log it.</p>
        </div>
      )}

      <div className="space-y-3">
        {blocks.map((b) => (
          <BlockCard
            key={b.exercise.id}
            block={b}
            units={units}
            logId={logId}
            onChange={(sets) => setBlocks((all) => all.map((x) => (x.exercise.id === b.exercise.id ? { ...x, sets } : x)))}
            onRest={startRest}
            onRemove={() => removeExercise(b.exercise.id)}
          />
        ))}
      </div>

      <button type="button" onClick={() => setPicker(true)} className={cn(btnGhost, 'mt-3 h-14 w-full border-dashed text-base')}>
        <Plus className="h-5 w-5" aria-hidden="true" /> Add exercise
      </button>

      <label className="mt-5 block text-sm text-white/65">
        Notes (only you see these)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => saveMeta({ notes })}
          rows={2}
          maxLength={2000}
          className="vip-focus mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-base text-white"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={discard} className="vip-focus min-h-11 rounded-xl px-3 text-sm text-red-200 hover:bg-red-500/10">
          Discard workout
        </button>
        {fromProgram && <span className="text-xs text-white/55">Finishing ticks off this program day.</span>}
      </div>

      {picker && <ExercisePicker exclude={blocks.map((b) => b.exercise.id)} onPick={addExercise} onClose={() => setPicker(false)} />}
      {rest && (
        <RestTimer
          endsAt={rest.endsAt}
          total={rest.total}
          onAdjust={(d) => setRest((r) => (r ? { endsAt: Math.max(Date.now(), r.endsAt + d * 1000), total: Math.max(1, r.total + d) } : r))}
          onClose={() => setRest(null)}
        />
      )}
    </div>
  )
}
