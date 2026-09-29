'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import type { MembershipTier } from '@prisma/client'
import {
  Bell, BookOpen, CalendarDays, Gift, Home, LogOut, Search, Shield, Users, UserRound, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, TierBadge, Wordmark } from './ui'

export interface ShellViewer {
  displayName: string
  avatarUrl: string | null
  tier: MembershipTier
  isAdmin: boolean
  suspended: boolean
}

const NAV = [
  { href: '/feed', label: 'Community', icon: Home, community: true },
  { href: '/classroom', label: 'Classroom', icon: BookOpen },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/members', label: 'Members', icon: Users, community: true },
  { href: '/rewards', label: 'Rewards', icon: Gift },
] as const

export function VipShell({
  viewer,
  unread,
  spaces,
  shopUrl,
  adminUrl,
  children,
}: {
  viewer: ShellViewer
  unread: number
  spaces: { slug: string; name: string }[]
  shopUrl: string
  adminUrl: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const nav = NAV.filter((n) => !(viewer.suspended && 'community' in n && n.community))
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === '/feed' && pathname.startsWith('/posts/'))

  async function signOut() {
    setSigningOut(true)
    await fetch('/api/vip/auth/logout', { method: 'POST' }).catch(() => {})
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#10132a]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/feed" className="vip-focus rounded-xl" aria-label="Clubhouse home">
            <span className="sm:hidden"><Wordmark compact /></span>
            <span className="hidden sm:inline"><Wordmark /></span>
          </Link>
          {!viewer.suspended && (
            <form action="/feed" method="get" role="search" className="ml-2 hidden flex-1 md:block">
              <label className="relative block max-w-md">
                <span className="sr-only">Search the community</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
                <input
                  name="q"
                  type="search"
                  placeholder="Search posts"
                  className="vip-focus h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-sm text-white placeholder:text-white/40"
                />
              </label>
            </form>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {!viewer.suspended && (
              <Link
                href="/notifications"
                className="vip-focus relative grid h-10 w-10 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06] hover:text-white"
                aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-[18px] text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
            )}
            <Link
              href="/profile"
              className="vip-focus flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-white/[0.06]"
              aria-label="Your profile"
            >
              <Avatar name={viewer.displayName} src={viewer.avatarUrl} size={32} />
              <span className="hidden max-w-[10rem] truncate text-sm font-medium lg:inline">{viewer.displayName}</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 pt-5 sm:px-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-[5.25rem] hidden h-[calc(100vh-6rem)] w-60 shrink-0 flex-col lg:flex" aria-label="Clubhouse">
          <nav className="space-y-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? 'page' : undefined}
                className={cn(
                  'vip-focus flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active(n.href) ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:bg-white/[0.04] hover:text-white',
                )}
              >
                <n.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {n.label}
              </Link>
            ))}
          </nav>

          {!viewer.suspended && spaces.length > 0 && (
            <div className="mt-6">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">Spaces</p>
              <nav className="mt-2 space-y-0.5" aria-label="Spaces">
                {spaces.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/feed?space=${encodeURIComponent(s.slug)}`}
                    className="vip-focus block truncate rounded-lg px-3 py-1.5 text-sm text-white/55 hover:bg-white/[0.04] hover:text-white"
                  >
                    # {s.name}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          <div className="mt-auto space-y-1 border-t border-white/[0.07] pt-4">
            <div className="flex items-center gap-2 px-3 pb-2">
              <TierBadge tier={viewer.tier} admin={viewer.isAdmin} />
            </div>
            <a
              href={shopUrl}
              className="vip-focus flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/[0.04] hover:text-white"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Shop at vitalityproject.global
            </a>
            {adminUrl && (
              <a
                href={adminUrl}
                className="vip-focus flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/[0.04] hover:text-white"
              >
                <Shield className="h-4 w-4" aria-hidden="true" />
                Clubhouse admin
              </a>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="vip-focus flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/60 hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </aside>

        <main id="main" className="vip-safe-bottom min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#10132a]/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Clubhouse"
      >
        <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${nav.length + 1}, minmax(0, 1fr))` }}>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? 'page' : undefined}
              className={cn(
                'vip-focus flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium',
                active(n.href) ? 'text-white' : 'text-white/50',
              )}
            >
              <n.icon className="h-5 w-5" aria-hidden="true" />
              {n.label}
            </Link>
          ))}
          <Link
            href="/profile"
            aria-current={active('/profile') ? 'page' : undefined}
            className={cn('vip-focus flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium', active('/profile') ? 'text-white' : 'text-white/50')}
          >
            <UserRound className="h-5 w-5" aria-hidden="true" />
            Me
          </Link>
        </div>
      </nav>
    </div>
  )
}
