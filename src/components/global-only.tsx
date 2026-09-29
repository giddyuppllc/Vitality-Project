'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

/**
 * Renders its children on every vitalityproject.global route, and nothing on
 * the clubhouse (the `vip` segment that src/proxy.ts rewrites .vip requests
 * into). Used in the root layout for the store-only pieces — marketing pixels,
 * the store's JSON-LD, the newsletter exit modal and the store's service
 * worker — so the private clubhouse never loads them.
 *
 * Segment-based rather than header-based on purpose: reading headers() in the
 * root layout would force every .global page to render dynamically. The
 * selected segment is known from the route tree, so static .global pages stay
 * static and render exactly the same markup as before.
 */
export function GlobalOnly({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment()
  if (segment === 'vip') return null
  return <>{children}</>
}
