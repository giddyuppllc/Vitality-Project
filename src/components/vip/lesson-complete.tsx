'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Award, CheckCircle2, Circle, Sparkles } from 'lucide-react'

export function LessonCompleteButton({ lessonId, initial }: { lessonId: string; initial: boolean }) {
  const router = useRouter()
  const [done, setDone] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [earned, setEarned] = useState<{ points: number; certificateCode: string | null } | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        aria-pressed={done}
        onClick={async () => {
          setBusy(true)
          const res = await fetch(`/api/vip/lessons/${lessonId}/progress`, { method: done ? 'DELETE' : 'POST' })
          if (res.ok) {
            const d = await res.json().catch(() => ({}))
            setDone(!done)
            if (!done && (d.pointsAwarded > 0 || d.certificateCode)) setEarned({ points: d.pointsAwarded ?? 0, certificateCode: d.courseCompleted ? d.certificateCode : null })
            else setEarned(null)
          }
          setBusy(false)
          router.refresh()
        }}
        className={
          done
            ? 'vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-4 text-sm font-semibold text-emerald-100'
            : 'vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600'
        }
      >
        {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
        {done ? 'Completed' : 'Mark complete'}
      </button>
      <div role="status" aria-live="polite">
        {earned && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#ead7a8]">
            {earned.points > 0 && (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> +{earned.points.toLocaleString('en-US')} points
              </span>
            )}
            {earned.certificateCode && (
              <Link href={`/certificate/${earned.certificateCode}`} className="vip-focus inline-flex items-center gap-1 rounded font-semibold underline underline-offset-2">
                <Award className="h-4 w-4" aria-hidden="true" /> Course complete — open your certificate
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
