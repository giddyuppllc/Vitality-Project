'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const POLL_MS = 30_000

/**
 * Top-bar Messages link with an unread badge. Polls the unread count every
 * 30 s while the tab is visible, on focus, and on every navigation (opening a
 * conversation clears its unread).
 */
export function MessagesNavLink() {
  const pathname = usePathname() || ''
  const [unread, setUnread] = useState(0)
  const active = pathname === '/messages' || pathname.startsWith('/messages/')

  useEffect(() => {
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
  }, [pathname])

  return (
    <Link
      href="/messages"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'vip-focus relative grid h-10 w-10 place-items-center rounded-xl hover:bg-white/[0.06] hover:text-white',
        active ? 'text-white' : 'text-white/70',
      )}
      aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}
    >
      <MessageSquare className="h-5 w-5" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-[18px] text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
