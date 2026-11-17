'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const POLL_MS = 30_000

/**
 * Live unread-conversation count for the shell. Starts from the count the
 * (club) layout loaded on the server (so the first paint is right), then
 * polls every 30 s while the tab is visible, on focus, on every navigation and
 * whenever a thread is read (`vip:messages-read`). One counter feeds every
 * Messages badge in the shell — the desktop rail, the mobile More sheet and
 * the mobile top-bar icon.
 */
export function useUnreadMessages(initial: number, enabled: boolean): number {
  const pathname = usePathname() || ''
  const [unread, setUnread] = useState(initial)

  useEffect(() => setUnread(initial), [initial])

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/vip/messages/unread', { cache: 'no-store' })
        if (res.ok && !stopped) setUnread((await res.json()).unread ?? 0)
      } catch {
        // offline — keep the last count
      }
    }
    load()
    const t = setInterval(load, POLL_MS)
    const onVis = () => load()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    window.addEventListener('vip:messages-read', onVis)
    return () => {
      stopped = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
      window.removeEventListener('vip:messages-read', onVis)
    }
  }, [pathname, enabled])

  return unread
}

/** Top-bar Messages icon with its unread badge (mobile; the desktop rail lists Messages itself). */
export function MessagesNavLink({ unread, className }: { unread: number; className?: string }) {
  const pathname = usePathname() || ''
  const active = pathname === '/messages' || pathname.startsWith('/messages/')
  return (
    <Link
      href="/messages"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'vip-focus relative grid h-11 w-11 place-items-center rounded-xl hover:bg-white/[0.06] hover:text-white',
        active ? 'text-white' : 'text-white/70',
        className,
      )}
      aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}
    >
      <MessageSquare className="h-5 w-5" aria-hidden="true" />
      {unread > 0 && (
        <span
          className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-[18px] text-white"
          aria-hidden="true"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
