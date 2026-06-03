'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  entityType: string | null
  entityId: string | null
  createdAt: string
  read: boolean
}

function relTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Anchor the portalled dropdown to the bell button's on-screen position.
  // The bell lives inside the fixed-width admin sidebar (w-60) while the
  // dropdown is wider (w-80); rendering it inline + position:absolute caused
  // it to be clipped by the sidebar's stacking/containing block on Safari
  // ("cut in half" on Mac). Portalling to <body> with position:fixed escapes
  // every ancestor clip and works identically across browsers.
  const [coords, setCoords] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const updateCoords = () => {
    const el = buttonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCoords({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    })
  }

  // Keep the dropdown anchored while it's open if the window resizes/scrolls.
  useEffect(() => {
    if (!open) return
    updateCoords()
    window.addEventListener('resize', updateCoords)
    window.addEventListener('scroll', updateCoords, true)
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
    }
  }, [open])

  const toggle = () => {
    if (!open) updateCoords()
    setOpen((v) => !v)
  }

  const load = async () => {
    try {
      const res = await fetch('/api/admin/notifications')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.notifications)
      setUnread(data.unread)
    } catch {
      // swallow
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  const markRead = async (id: string) => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const markAllRead = async () => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    load()
  }

  const dropdown = open ? (
    <>
      <div
        className="fixed inset-0 z-[1000]"
        onClick={() => setOpen(false)}
      />
      <div
        className="fixed w-80 max-h-[70vh] bg-dark-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[1001] flex flex-col"
        style={{ top: coords.top, right: coords.right }}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="overflow-auto flex-1">
          {items.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((n) => {
                const content = (
                  <div
                    className={cn(
                      'p-4 text-sm transition-colors',
                      n.read ? 'text-white/60' : 'bg-brand-500/5 text-white',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{n.title}</p>
                        <p className="text-white/50 text-xs mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-white/30 text-[10px] mt-1">
                          {relTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          markRead(n.id)
                          setOpen(false)
                        }}
                        className="block hover:bg-white/5"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        onClick={() => markRead(n.id)}
                        className="w-full text-left hover:bg-white/5"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  ) : null

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        className="relative p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {mounted && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  )
}
