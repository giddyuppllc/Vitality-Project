'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from './ui'
import { FollowButton } from './follow-button'

/**
 * First-run steps contributed by the social and fitness features. Data comes
 * from the /welcome page (server) through OnboardingExtraContext; each step
 * saves as the member acts (following someone, choosing units), so "Finish"
 * and "Skip for now" need nothing more from them.
 */
export interface OnboardingSuggestion {
  id: string
  displayName: string
  avatarUrl: string | null
  reason: string
}

export interface OnboardingExtraContext {
  suggestions: OnboardingSuggestion[]
  units: 'IMPERIAL' | 'METRIC'
}

export function FollowSuggestionsStep({ suggestions }: { suggestions: OnboardingSuggestion[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Follow a few people and their posts lead your Following feed and your home page. You can unfollow any time.
      </p>
      <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.03]" data-testid="onboarding-suggestions">
        {suggestions.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3.5">
            <Avatar name={m.displayName} src={m.avatarUrl} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.displayName}</span>
              <span className="block truncate text-xs text-white/60">{m.reason}</span>
            </span>
            <FollowButton userId={m.id} name={m.displayName} initialFollowing={false} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FitnessUnitsStep({ initial }: { initial: 'IMPERIAL' | 'METRIC' }) {
  const [units, setUnits] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(next: 'IMPERIAL' | 'METRIC') {
    if (next === units) return
    const prev = units
    setUnits(next)
    setBusy(true)
    setError(null)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const res = await fetch('/api/vip/fitness/prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ units: next, tz }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      setUnits(prev)
      setError('That didn’t save. Please try again.')
    }
  }

  const options = [
    { value: 'IMPERIAL' as const, title: 'Pounds and inches', body: 'lb, in, oz' },
    { value: 'METRIC' as const, title: 'Kilograms and centimetres', body: 'kg, cm, ml' },
  ]
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Your workout log, body measurements and check-ins use these units. Change them any time under Fitness.
      </p>
      <div role="radiogroup" aria-label="Units" className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const on = units === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy}
              onClick={() => choose(o.value)}
              className={cn(
                'vip-focus flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-70',
                on ? 'border-brand-400/60 bg-brand-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
              )}
              data-testid={`units-${o.value.toLowerCase()}`}
            >
              <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border', on ? 'border-brand-300 bg-brand-500' : 'border-white/30')} aria-hidden="true">
                {on && (busy ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : <Check className="h-3 w-3 text-white" />)}
              </span>
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="mt-0.5 block text-sm text-white/65">{o.body}</span>
              </span>
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  )
}
