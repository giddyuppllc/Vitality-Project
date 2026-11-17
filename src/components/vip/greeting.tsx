'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

function part(hour: number): string {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * "Good morning, Sam" in the VIEWER's local time. The server renders the
 * greeting for the clubhouse time zone; the client corrects it after load.
 */
export function Greeting({ name, serverHour }: { name: string; serverHour: number }) {
  const text = useSyncExternalStore(
    subscribe,
    () => part(new Date().getHours()),
    () => part(serverHour),
  )
  return (
    <>
      {text}, {name}
    </>
  )
}
