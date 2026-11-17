'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, Check, Loader2, Route, Sparkles, Target, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_GOALS, ONBOARDING_GOALS, ONBOARDING_INTERESTS } from '@/lib/vip/onboarding-options'

export interface OnboardingTrack {
  id: string
  title: string
  summary: string | null
  category: string
  courseCount: number
}

interface State {
  displayName: string
  bio: string
  interests: string[]
  goals: string[]
  trackId: string | null
  emailDigest: boolean
  emailEvents: boolean
  emailRewards: boolean
}

/**
 * Extra first-run steps contributed by other clubhouse features. The
 * "follow suggested members" step belongs to the social builder: at merge,
 * push a step here (it receives the shared state and renders its own UI).
 * Nothing is shown for it until then.
 */
export const ONBOARDING_EXTRA_STEPS: Array<{
  key: string
  title: string
  icon: typeof UserRound
  render: () => React.ReactNode
}> = []

function Chip({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled && !on}
      onClick={onClick}
      className={cn(
        'vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-40',
        on ? 'border-brand-400/60 bg-brand-500/20 text-white' : 'border-white/12 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]',
      )}
    >
      {on && <Check className="h-4 w-4 text-brand-200" aria-hidden="true" />}
      {label}
    </button>
  )
}

function Toggle({ checked, onChange, title, body }: { checked: boolean; onChange: (v: boolean) => void; title: string; body: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#4aa3f7]">
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-white/65">{body}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={cn('relative mt-1 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-500' : 'bg-white/20')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </label>
  )
}

export function OnboardingFlow({
  firstName,
  initial,
  tracks,
  suspended,
}: {
  firstName: string
  initial: State
  tracks: OnboardingTrack[]
  suspended: boolean
}) {
  const router = useRouter()
  const [s, setS] = useState<State>(initial)
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((x) => ({ ...x, [k]: v }))
  const toggleIn = (k: 'interests' | 'goals', key: string) =>
    setS((x) => ({ ...x, [k]: x[k].includes(key) ? x[k].filter((y) => y !== key) : [...x[k], key] }))

  const steps = [
    ...(suspended ? [] : [{ key: 'profile', title: 'Introduce yourself', icon: UserRound }]),
    { key: 'interests', title: 'What are you into?', icon: Sparkles },
    { key: 'goals', title: 'What are you working toward?', icon: Target },
    { key: 'notifications', title: 'How should we keep you posted?', icon: Bell },
    ...(tracks.length ? [{ key: 'path', title: 'Pick a learning path', icon: Route }] : []),
    ...ONBOARDING_EXTRA_STEPS.map(({ key, title, icon }) => ({ key, title, icon })),
  ]
  const step = steps[i]
  const last = i === steps.length - 1

  useEffect(() => {
    heading.current?.focus()
  }, [i])

  async function finish(skip = false) {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/vip/onboarding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skip ? { skip: true } : { ...s, displayName: s.displayName.trim(), bio: s.bio.trim() }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBusy(false)
      return setError(d.error || 'That didn’t save. Please try again.')
    }
    router.replace(skip ? '/dashboard' : d.next || '/dashboard')
    router.refresh()
  }

  const extra = ONBOARDING_EXTRA_STEPS.find((x) => x.key === step.key)

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-white/65">
          Step {i + 1} of {steps.length}
        </p>
        <button type="button" onClick={() => finish(true)} disabled={busy} className="vip-focus min-h-[44px] rounded-lg px-2 text-sm text-white/65 hover:text-white">
          Skip for now
        </button>
      </div>
      <div className="mb-6 flex gap-1.5" aria-hidden="true">
        {steps.map((st, n) => (
          <span key={st.key} className={cn('h-1.5 flex-1 rounded-full', n <= i ? 'bg-brand-400' : 'bg-white/10')} />
        ))}
      </div>

      <section className="vip-surface-strong p-5 sm:p-7" aria-labelledby="step-h">
        {i === 0 && <p className="mb-2 text-sm font-semibold text-[#ead7a8]">Welcome in, {firstName}.</p>}
        <h1 id="step-h" ref={heading} tabIndex={-1} className="flex items-center gap-2.5 text-2xl font-bold tracking-tight outline-none">
          <step.icon className="h-6 w-6 shrink-0 text-brand-300" aria-hidden="true" /> {step.title}
        </h1>

        <div className="mt-5">
          {step.key === 'profile' && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">This is how other members see you. You can change it any time from your profile.</p>
              <label className="block text-sm font-medium">
                Display name
                <input
                  value={s.displayName}
                  onChange={(e) => set('displayName', e.target.value)}
                  maxLength={60}
                  autoComplete="nickname"
                  className="vip-focus mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-[15px] text-white"
                />
              </label>
              <label className="block text-sm font-medium">
                A line about you <span className="font-normal text-white/60">(optional)</span>
                <textarea
                  value={s.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder="What you train for, what a great year looks like…"
                  className="vip-focus mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] p-3 text-[15px] text-white placeholder:text-white/50"
                />
              </label>
            </div>
          )}

          {step.key === 'interests' && (
            <div>
              <p className="text-sm text-white/70">Pick as many as you like — we use them to suggest courses and sessions.</p>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Interests">
                {ONBOARDING_INTERESTS.map((o) => (
                  <Chip key={o.key} on={s.interests.includes(o.key)} label={o.label} onClick={() => toggleIn('interests', o.key)} />
                ))}
              </div>
            </div>
          )}

          {step.key === 'goals' && (
            <div>
              <p className="text-sm text-white/70">Choose up to {MAX_GOALS}. Focus beats a long list.</p>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Goals">
                {ONBOARDING_GOALS.map((o) => (
                  <Chip key={o.key} on={s.goals.includes(o.key)} label={o.label} disabled={s.goals.length >= MAX_GOALS} onClick={() => toggleIn('goals', o.key)} />
                ))}
              </div>
              <p className="mt-3 text-xs text-white/60" aria-live="polite">
                {s.goals.length}/{MAX_GOALS} chosen
              </p>
            </div>
          )}

          {step.key === 'notifications' && (
            <div className="space-y-3">
              <Toggle checked={s.emailEvents} onChange={(v) => set('emailEvents', v)} title="Session reminders" body="A day before and an hour before sessions you RSVP to." />
              <Toggle checked={s.emailDigest} onChange={(v) => set('emailDigest', v)} title="Daily digest" body="One email a day when members reply to you or mention you." />
              <Toggle checked={s.emailRewards} onChange={(v) => set('emailRewards', v)} title="Monthly reward notice" body="A short note when your monthly credit lands." />
            </div>
          )}

          {step.key === 'path' && (
            <div>
              <p className="text-sm text-white/70">Start somewhere specific. You can explore every other path whenever you like.</p>
              <div className="mt-4 space-y-2" role="radiogroup" aria-label="Learning paths">
                {tracks.map((t) => {
                  const on = s.trackId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set('trackId', on ? null : t.id)}
                      className={cn(
                        'vip-focus flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                        on ? 'border-brand-400/60 bg-brand-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                      )}
                    >
                      <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border', on ? 'border-brand-300 bg-brand-500' : 'border-white/30')} aria-hidden="true">
                        {on && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{t.title}</span>
                        {t.summary && <span className="mt-0.5 block text-sm text-white/65">{t.summary}</span>}
                        <span className="mt-1 block text-xs text-white/60">
                          {t.courseCount} {t.courseCount === 1 ? 'course' : 'courses'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {extra?.render()}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5">
          {i > 0 ? (
            <button type="button" onClick={() => setI(i - 1)} className="vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/75 hover:bg-white/[0.06]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          {last ? (
            <button type="button" onClick={() => finish(false)} disabled={busy} className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60" data-testid="onboarding-finish">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Finish
            </button>
          ) : (
            <button type="button" onClick={() => setI(i + 1)} className="vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600" data-testid="onboarding-next">
              Next <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
