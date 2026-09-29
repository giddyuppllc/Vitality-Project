'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'

export function LessonCompleteButton({ lessonId, initial }: { lessonId: string; initial: boolean }) {
  const router = useRouter()
  const [done, setDone] = useState(initial)
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={done}
      onClick={async () => {
        setBusy(true)
        const res = await fetch(`/api/vip/lessons/${lessonId}/progress`, { method: done ? 'DELETE' : 'POST' })
        if (res.ok) setDone(!done)
        setBusy(false)
        router.refresh()
      }}
      className={
        done
          ? 'vip-focus inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100'
          : 'vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600'
      }
    >
      {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
      {done ? 'Completed' : 'Mark complete'}
    </button>
  )
}
