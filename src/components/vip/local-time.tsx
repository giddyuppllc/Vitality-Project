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

/** Month + day badge in the viewer's time zone (matches <LocalTime>). */
export function LocalDateBadge({ iso }: { iso: string }) {
  const d = new Date(iso)
  const [month, day] = useSyncExternalStore(
    subscribe,
    () => `${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}|${d.getDate()}`,
    () => `${d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()}|${d.getUTCDate()}`,
  ).split('|')
  return (
    <>
      <span className="text-[10px] font-bold tracking-wider text-brand-300">{month}</span>
      <span className="text-xl font-bold">{day}</span>
    </>
  )
}
