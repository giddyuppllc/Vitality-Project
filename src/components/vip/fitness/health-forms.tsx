'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Camera, Check, Loader2, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, browserTz, ErrorText } from './actions'
import { btnPrimary } from './styles'

type Units = 'IMPERIAL' | 'METRIC'

export interface CheckinValues {
  water: number | null // in member units
  sleepHours: number | null
  steps: number | null
  mood: number | null
  energy: number | null
  workoutDone: boolean
  notes: string | null
}

const field =
  'vip-focus h-12 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 text-base tabular-nums text-white placeholder:text-white/40'

function Scale({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (v: number | null) => void; low: string; high: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-white/75">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label} ${n} of 5`}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              'vip-focus h-12 rounded-xl border text-base font-semibold',
              value === n ? 'border-brand-400/60 bg-brand-500/30 text-white' : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-white/50">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  )
}

function emptyValues(): CheckinValues {
  return { water: null, sleepHours: null, steps: null, mood: null, energy: null, workoutDone: false, notes: null }
}

/** Today / yesterday check-in. Values are in the member's units; the API converts. */
export function CheckinForm({ units, today, yesterday }: { units: Units; today: CheckinValues | null; yesterday: CheckinValues | null }) {
  const router = useRouter()
  const [day, setDay] = useState<'today' | 'yesterday'>('today')
  const [vals, setVals] = useState<CheckinValues>(today ?? emptyValues())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const set = <K extends keyof CheckinValues>(k: K, v: CheckinValues[K]) => setVals((x) => ({ ...x, [k]: v }))
  const waterStep = units === 'METRIC' ? 250 : 8
  const waterUnit = units === 'METRIC' ? 'ml' : 'oz'
  const existing = day === 'today' ? today : yesterday

  function switchDay(d: 'today' | 'yesterday') {
    setDay(d)
    setVals((d === 'today' ? today : yesterday) ?? emptyValues())
    setResult(null)
    setError(null)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    const r = await api<{ points: number; streak: number; streakBonus: number; challengesCompleted: { title: string }[] }>(
      '/api/vip/fitness/checkins',
      'PUT',
      { day, tz: browserTz(), units, ...vals },
    )
    setBusy(false)
    if (!r.ok) return setError(r.data.error || 'Could not save your check-in.')
    const bits = [`Saved. Streak: ${r.data.streak} day${r.data.streak === 1 ? '' : 's'}.`]
    if (r.data.points) bits.push(`+${r.data.points} points.`)
    if (r.data.streakBonus) bits.push(`7-day streak bonus +${r.data.streakBonus}!`)
    for (const c of r.data.challengesCompleted ?? []) bits.push(`Challenge complete: ${c.title}.`)
    setResult(bits.join(' '))
    router.refresh()
  }

  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  return (
    <form onSubmit={save} className="space-y-4">
      <div role="tablist" aria-label="Which day" className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
        {(['today', 'yesterday'] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={day === d}
            onClick={() => switchDay(d)}
            className={cn('vip-focus min-h-10 rounded-lg px-4 font-medium capitalize', day === d ? 'bg-brand-500/25 text-white' : 'text-white/60 hover:text-white')}
          >
            {d}
            {(d === 'today' ? today : yesterday) && <Check className="ml-1 inline h-3.5 w-3.5 text-emerald-300" aria-label="checked in" />}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="ci-water" className="mb-1.5 block text-sm font-medium text-white/75">
          Water ({waterUnit})
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => set('water', Math.max(0, (vals.water ?? 0) - waterStep))} className="vip-focus grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/12" aria-label={`Remove ${waterStep} ${waterUnit}`}>
            <Minus className="h-5 w-5" aria-hidden="true" />
          </button>
          <input id="ci-water" inputMode="numeric" className={cn(field, 'text-center')} value={vals.water ?? ''} onChange={(e) => set('water', num(e.target.value))} placeholder="0" />
          <button type="button" onClick={() => set('water', (vals.water ?? 0) + waterStep)} className="vip-focus grid h-12 shrink-0 place-items-center rounded-xl border border-white/12 px-3 text-sm font-semibold" aria-label={`Add ${waterStep} ${waterUnit}`}>
            <span className="inline-flex items-center gap-1">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {waterStep}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-white/75">
          Sleep (hours)
          <input inputMode="decimal" className={cn(field, 'mt-1.5')} value={vals.sleepHours ?? ''} onChange={(e) => set('sleepHours', num(e.target.value.replace(/[^\d.]/g, '')))} placeholder="7.5" />
        </label>
        <label className="block text-sm font-medium text-white/75">
          Steps
          <input inputMode="numeric" className={cn(field, 'mt-1.5')} value={vals.steps ?? ''} onChange={(e) => set('steps', num(e.target.value.replace(/\D/g, '')))} placeholder="8000" />
        </label>
      </div>

      <Scale label="Mood" value={vals.mood} onChange={(v) => set('mood', v)} low="Low" high="Great" />
      <Scale label="Energy" value={vals.energy} onChange={(v) => set('energy', v)} low="Drained" high="Charged" />

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium">
        <input type="checkbox" checked={vals.workoutDone} onChange={(e) => set('workoutDone', e.target.checked)} className="h-5 w-5 accent-brand-500" />
        I trained {day === 'today' ? 'today' : 'yesterday'}
      </label>

      <label className="block text-sm font-medium text-white/75">
        Notes (optional)
        <textarea rows={2} maxLength={1000} className="vip-focus mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.04] p-3 text-base text-white" value={vals.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </label>

      <button type="submit" disabled={busy} className={cn(btnPrimary, 'h-12 w-full text-base')}>
        {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {existing ? 'Update check-in' : 'Save check-in'}
      </button>
      {result && (
        <p role="status" className="text-sm text-emerald-200">
          {result}
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </form>
  )
}

/** Body-metric entry for a date (defaults to today). */
export function MetricsForm({ units, today }: { units: Units; today: string }) {
  const router = useRouter()
  const w = units === 'METRIC' ? 'kg' : 'lb'
  const l = units === 'METRIC' ? 'cm' : 'in'
  const [date, setDate] = useState(today)
  const [v, setV] = useState<Record<string, string>>({})
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const n = (k: string) => (v[k]?.trim() ? Number(v[k]) : null)
  const input = (k: string, label: string) => (
    <label className="block text-sm font-medium text-white/75">
      {label}
      <input inputMode="decimal" className={cn(field, 'mt-1.5')} value={v[k] ?? ''} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.]/g, '') }))} />
    </label>
  )
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        setOk(false)
        const r = await api('/api/vip/fitness/metrics', 'PUT', {
          date,
          tz: browserTz(),
          units,
          weight: n('weight'),
          bodyFatPct: n('bodyFatPct'),
          waist: n('waist'),
          chest: n('chest'),
          hips: n('hips'),
          arm: n('arm'),
          thigh: n('thigh'),
        })
        setBusy(false)
        if (!r.ok) return setError(r.data.error || 'Could not save.')
        setOk(true)
        setV({})
        router.refresh()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-white/75">
          Date
          <input type="date" max={today} className={cn(field, 'mt-1.5')} value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        {input('weight', `Weight (${w})`)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {input('bodyFatPct', 'Body fat (%)')}
        {input('waist', `Waist (${l})`)}
      </div>
      {more ? (
        <div className="grid grid-cols-2 gap-3">
          {input('chest', `Chest (${l})`)}
          {input('hips', `Hips (${l})`)}
          {input('arm', `Upper arm (${l})`)}
          {input('thigh', `Thigh (${l})`)}
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="vip-focus min-h-10 rounded-lg text-sm font-medium text-brand-300 hover:text-brand-200">
          + More measurements
        </button>
      )}
      <button type="submit" disabled={busy} className={cn(btnPrimary, 'w-full')}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Save measurements
      </button>
      {ok && (
        <p role="status" className="text-sm text-emerald-200">
          Saved.
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </form>
  )
}

/** Private progress-photo upload. */
export function PhotoUpload({ today }: { today: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pose, setPose] = useState('front')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function upload(file: File) {
    setBusy(true)
    setError(null)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('pose', pose)
    fd.set('date', today)
    const tz = browserTz()
    if (tz) fd.set('tz', tz)
    const res = await fetch('/api/vip/fitness/photos', { method: 'POST', body: fd }).catch(() => null)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}))
      return setError(d?.error || 'Upload failed. Try again.')
    }
    router.refresh()
  }
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-medium text-white/75">
          Angle
          <select value={pose} onChange={(e) => setPose(e.target.value)} className="vip-focus mt-1.5 block h-12 rounded-xl border border-white/12 bg-[#0f1729] px-3 text-base text-white">
            <option value="front">Front</option>
            <option value="side">Side</option>
            <option value="back">Back</option>
          </select>
        </label>
        <label className={cn(btnPrimary, 'h-12 cursor-pointer', busy && 'pointer-events-none opacity-50')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
          Add a photo
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
            }}
          />
        </label>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
