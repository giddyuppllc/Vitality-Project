'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * Event times in the VIEWER's time zone. The server renders UTC (it has no
 * idea where the member is); the client swaps in local time after hydration.
 */
export function LocalTime({ iso }: { iso: string }) {
  const d = new Date(iso)
  const text = useSyncExternalStore(
    subscribe,
    () =>
      `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`,
    () =>
      `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}`,
  )
  return <time dateTime={iso}>{text}</time>
}
