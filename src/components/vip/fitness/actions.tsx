'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Play, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btnGhost, btnPrimary } from './styles'

export const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

export async function api<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => null)
  if (!res) return { ok: false, status: 0, data: { error: 'No connection. Check your signal and try again.' } as T & { error?: string } }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  return { ok: res.ok, status: res.status, data }
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-2 text-sm text-red-300">
      {children}
    </p>
  )
}

/**
 * Start a workout (a program day, or freestyle). If another workout is still
 * open the member chooses: resume it, or discard it and start this one.
 */
export function StartWorkoutButton({
  programDayId,
  label = 'Start workout',
  className,
  full,
}: {
  programDayId?: string
  label?: string
  className?: string
  full?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    const r = await api<{ id?: string; openId?: string }>('/api/vip/fitness/workouts', 'POST', { programDayId: programDayId ?? null, tz: browserTz() })
    if (r.ok && r.data.id) {
      router.push(`/fitness/workout/${r.data.id}`)
      return
    }
    setBusy(false)
    if (r.status === 409 && r.data.openId) setOpenId(r.data.openId)
    else setError(r.data.error || 'Could not start the workout.')
  }

  async function discardAndStart() {
    if (!openId) return
    setBusy(true)
    await api(`/api/vip/fitness/workouts/${openId}`, 'DELETE')
    setOpenId(null)
    await start()
  }

  return (
    <div className={cn(full && 'w-full')}>
      <button type="button" onClick={start} disabled={busy} className={cn(btnPrimary, full && 'w-full', className)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        {label}
      </button>
      {openId && (
        <div role="alert" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/[0.07] p-3 text-sm text-amber-50">
          <p>You have a workout in progress.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/fitness/workout/${openId}`} className={btnPrimary}>
              Resume it
            </Link>
            <button type="button" onClick={discardAndStart} disabled={busy} className={btnGhost}>
              Discard it and start this one
            </button>
          </div>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

/** Enroll / resume / restart / pause a program; mark a rest day done. */
export function ProgramAction({
  programId,
  action,
  dayId,
  label,
  confirmText,
  ghost,
  full,
}: {
  programId: string
  action: 'enroll' | 'restart' | 'pause' | 'rest-day'
  dayId?: string
  label: string
  confirmText?: string
  ghost?: boolean
  full?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className={cn(full && 'w-full')}>
      <button
        type="button"
        disabled={busy}
        className={cn(ghost ? btnGhost : btnPrimary, full && 'w-full')}
        onClick={async () => {
          if (confirmText && !window.confirm(confirmText)) return
          setBusy(true)
          setError(null)
          const r = await api(`/api/vip/fitness/programs/${programId}`, 'POST', { action, dayId })
          setBusy(false)
          if (!r.ok) setError(r.data.error || 'That did not work. Try again.')
          else router.refresh()
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {label}
      </button>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

export function ChallengeJoinButton({ challengeId, joined, completed }: { challengeId: string; joined: boolean; completed: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (completed) return null
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className={joined ? btnGhost : btnPrimary}
        onClick={async () => {
          if (joined && !window.confirm('Leave this challenge? Your activity stays logged; you can join again while it runs.')) return
          setBusy(true)
          setError(null)
          const r = await api(`/api/vip/fitness/challenges/${challengeId}`, 'POST', { action: joined ? 'leave' : 'join' })
          setBusy(false)
          if (!r.ok) setError(r.data.error || 'That did not work. Try again.')
          else router.refresh()
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {joined ? 'Leave challenge' : 'Join challenge'}
      </button>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

/** Units (imperial/metric) segmented toggle. */
export function UnitsToggle({ units }: { units: 'IMPERIAL' | 'METRIC' }) {
  const router = useRouter()
  const [value, setValue] = useState(units)
  async function pick(u: 'IMPERIAL' | 'METRIC') {
    if (u === value) return
    setValue(u)
    const r = await api('/api/vip/fitness/prefs', 'PATCH', { units: u })
    if (r.ok) router.refresh()
    else setValue(value)
  }
  return (
    <div role="radiogroup" aria-label="Units" className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
      {(['IMPERIAL', 'METRIC'] as const).map((u) => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={value === u}
          onClick={() => pick(u)}
          className={cn('vip-focus min-h-9 rounded-lg px-3 font-medium', value === u ? 'bg-brand-500/25 text-white' : 'text-white/60 hover:text-white')}
        >
          {u === 'IMPERIAL' ? 'lb · in · oz' : 'kg · cm · ml'}
        </button>
      ))}
    </div>
  )
}

/** Generic "delete this thing of mine" button (workout, body-metric entry, photo). */
export function DeleteButton({ url, confirmText, label, redirectTo, compact }: { url: string; confirmText: string; label: string; redirectTo?: string; compact?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={busy}
        aria-label={compact ? label : undefined}
        onClick={async () => {
          if (!window.confirm(confirmText)) return
          setBusy(true)
          const r = await api(url, 'DELETE')
          setBusy(false)
          if (!r.ok) return setError(r.data.error || 'Could not delete.')
          if (redirectTo) router.push(redirectTo)
          router.refresh()
        }}
        className={cn(
          'vip-focus inline-flex items-center justify-center gap-1.5 rounded-xl text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50',
          compact ? 'h-11 w-11' : 'min-h-11 px-3',
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : compact ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : null}
        {!compact && label}
      </button>
      <ErrorText>{error}</ErrorText>
    </span>
  )
}
