'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

export function RsvpButton({
  eventId,
  initialGoing,
  initialCount,
}: {
  eventId: string
  initialGoing: boolean
  initialCount: number
}) {
  const [going, setGoing] = useState(initialGoing)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={going}
      onClick={async () => {
        setBusy(true)
        const res = await fetch(`/api/vip/events/${eventId}/rsvp`, { method: going ? 'DELETE' : 'POST' })
        if (res.ok) {
          const d = await res.json()
          setGoing(d.going)
          setCount(d.count)
        }
        setBusy(false)
      }}
      className={
        going
          ? 'vip-focus inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-3.5 py-2 text-sm font-semibold text-emerald-100'
          : 'vip-focus inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600'
      }
    >
      {going && <Check className="h-4 w-4" aria-hidden="true" />}
      {going ? 'Going' : 'RSVP'}
      <span className="font-normal opacity-70">· {count}</span>
    </button>
  )
}
