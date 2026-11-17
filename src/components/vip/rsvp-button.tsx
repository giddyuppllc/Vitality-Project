'use client'

import { useState } from 'react'
import { Check, Clock3 } from 'lucide-react'

/**
 * RSVP toggle. On a full session the member joins the waitlist instead and
 * is moved to "Going" automatically when a seat frees up.
 */
export function RsvpButton({
  eventId,
  initialGoing,
  initialCount,
  initialWaitlisted = false,
  initialPosition = null,
  capacity = null,
}: {
  eventId: string
  initialGoing: boolean
  initialCount: number
  initialWaitlisted?: boolean
  initialPosition?: number | null
  capacity?: number | null
}) {
  const [going, setGoing] = useState(initialGoing)
  const [waitlisted, setWaitlisted] = useState(initialWaitlisted)
  const [position, setPosition] = useState<number | null>(initialPosition)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = !!capacity && count >= capacity
  const joined = going || waitlisted

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        aria-pressed={joined}
        onClick={async () => {
          setBusy(true)
          setError(null)
          const res = await fetch(`/api/vip/events/${eventId}/rsvp`, { method: joined ? 'DELETE' : 'POST' })
          const d = await res.json().catch(() => ({}))
          if (res.ok) {
            setGoing(!!d.going)
            setWaitlisted(!!d.waitlisted)
            setPosition(d.position ?? null)
            setCount(d.count)
          } else {
            setError(d.error || 'That didn’t go through. Try again.')
          }
          setBusy(false)
        }}
        className={
          going
            ? 'vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-3.5 text-sm font-semibold text-emerald-100'
            : waitlisted
              ? 'vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3.5 text-sm font-semibold text-amber-100'
              : 'vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 text-sm font-semibold text-white hover:bg-brand-600'
        }
      >
        {going && <Check className="h-4 w-4" aria-hidden="true" />}
        {waitlisted && <Clock3 className="h-4 w-4" aria-hidden="true" />}
        {going ? 'Going' : waitlisted ? `On the waitlist${position ? ` · #${position}` : ''}` : full ? 'Join the waitlist' : 'RSVP'}
        {!waitlisted && (
          <span className="font-normal opacity-80">
            · {count}
            {capacity ? `/${capacity}` : ''}
          </span>
        )}
      </button>
      {joined && (
        <span className="sr-only" role="status">
          {going ? 'You are going.' : 'You are on the waitlist.'} Press again to leave.
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-red-200">
          {error}
        </span>
      )}
    </span>
  )
}
