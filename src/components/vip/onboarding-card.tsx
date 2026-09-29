'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { VIP_COPY } from '@/lib/vip/copy'
import type { OnboardingStep } from '@/lib/vip/onboarding'

export function OnboardingCard({ steps }: { steps: OnboardingStep[] }) {
  const router = useRouter()
  const [hidden, setHidden] = useState(false)
  const O = VIP_COPY.onboarding
  const done = steps.filter((s) => s.done).length
  if (hidden) return null
  async function hide() {
    setHidden(true)
    await fetch('/api/vip/onboarding', { method: 'POST' }).catch(() => {})
    router.refresh()
  }
  return (
    <section className="vip-surface-strong vip-premium mb-4 p-5" aria-labelledby="start-here" data-testid="onboarding">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="start-here" className="font-semibold">{O.title}</h2>
          <p className="mt-0.5 text-sm text-white/60">{O.body}</p>
        </div>
        <button type="button" onClick={hide} className="vip-focus rounded-lg p-1.5 text-white/45 hover:bg-white/[0.06] hover:text-white" aria-label={O.hide}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Checklist progress">
        <div className="h-full rounded-full bg-[#d4b26a]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link href={s.href} className="vip-focus flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm hover:bg-white/[0.05]">
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-label="Done" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-white/35" aria-label="To do" />
              )}
              <span className={s.done ? 'text-white/50 line-through decoration-white/25' : 'text-white/85'}>{s.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
