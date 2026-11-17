'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MembershipTier } from '@prisma/client'
import { Bell, ExternalLink, LayoutGrid, LogOut, Search, Shield, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isActive, visibleNav, type VipNavBadge, type VipNavItem } from '@/lib/vip/nav'
import { Avatar, TierBadge, Wordmark } from './ui'

export interface ShellViewer {
  displayName: string
  avatarUrl: string | null
  tier: MembershipTier
  isAdmin: boolean
  suspended: boolean
}

type Badges = Partial<Record<VipNavBadge, number>>

function Count({ n, className }: { n: number | undefined; className?: string }) {
  if (!n) return null
  return (
    <span
      className={cn('grid min-w-[18px] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-[18px] text-white', className)}
      aria-hidden="true"
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

function navLabel(item: VipNavItem, badges: Badges): string {
  const n = item.badge ? badges[item.badge] : 0
  return n ? `${item.label}, ${n} unread` : item.label
}

/**
 * Clubhouse shell. Navigation comes from ONE array (lib/vip/nav.ts):
 *  - desktop (lg+): a left rail — main sections, then everything else, spaces,
 *    and the account footer;
 *  - mobile: a five-tab bottom bar plus "More", which opens a sheet with the
 *    remaining sections.
 */
export function VipShell({
  viewer,
  badges,
  spaces,
  shopUrl,
  adminUrl,
  children,
}: {
  viewer: ShellViewer
  badges: Badges
  spaces: { slug: string; name: string }[]
  shopUrl: string
  adminUrl: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const nav = visibleNav({ suspended: viewer.suspended })
  const tabs = nav.filter((n) => n.tab).slice(0, 5)
  const main = nav.filter((n) => n.group === 'main')
  const more = nav.filter((n) => n.group === 'more')
  const sheetItems = nav.filter((n) => !n.tab)
  const moreActive = sheetItems.some((n) => isActive(n, pathname))
  const moreBadge = sheetItems.reduce((s, n) => s + (n.badge ? badges[n.badge] ?? 0 : 0), 0)
  const unread = badges.notifications ?? 0

  // Close the sheet on navigation.
  useEffect(() => setMoreOpen(false), [pathname])

  async function signOut() {
    setSigningOut(true)
    await fetch('/api/vip/auth/logout', { method: 'POST' }).catch(() => {})
    router.replace('/')
    router.refresh()
  }

  const railLink = (n: VipNavItem) => {
    const on = isActive(n, pathname)
    return (
      <Link
        key={n.key}
        href={n.href}
        aria-current={on ? 'page' : undefined}
        aria-label={navLabel(n, badges)}
        className={cn(
          'vip-focus group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          on ? 'bg-brand-500/15 text-white ring-1 ring-inset ring-brand-400/25' : 'text-white/65 hover:bg-white/[0.05] hover:text-white',
        )}
      >
        <n.icon className={cn('h-[18px] w-[18px] shrink-0', on ? 'text-brand-300' : 'text-white/50 group-hover:text-white/80')} aria-hidden="true" />
        <span className="flex-1">{n.label}</span>
        <Count n={n.badge ? badges[n.badge] : 0} />
      </Link>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="vip-no-print sticky top-0 z-40 border-b border-white/[0.07] bg-[#070b14]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="vip-focus rounded-xl" aria-label="Clubhouse home">
            <span className="sm:hidden"><Wordmark compact /></span>
            <span className="hidden sm:inline"><Wordmark /></span>
          </Link>
          {!viewer.suspended && (
            <form action="/feed" method="get" role="search" className="ml-6 hidden flex-1 md:block">
              <label className="relative block max-w-md">
                <span className="sr-only">Search the community</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden="true" />
                <input
                  name="q"
                  type="search"
                  placeholder="Search posts"
                  className="vip-focus h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-sm text-white placeholder:text-white/50"
                />
              </label>
            </form>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {!viewer.suspended && (
              <Link
                href="/notifications"
                aria-current={pathname.startsWith('/notifications') ? 'page' : undefined}
                className="vip-focus relative grid h-11 w-11 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06] hover:text-white"
                aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                <Count n={unread} className="absolute right-1 top-1" />
              </Link>
            )}
            <Link href="/profile" className="vip-focus flex min-h-[44px] items-center gap-2 rounded-xl p-1 pr-2 hover:bg-white/[0.06]">
              <span aria-hidden="true"><Avatar name={viewer.displayName} src={viewer.avatarUrl} size={32} /></span>
              <span className="sr-only lg:hidden">Your profile</span>
              <span className="hidden max-w-[10rem] truncate text-sm font-medium lg:inline">{viewer.displayName}</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 pt-5 sm:px-6">
        {/* Desktop rail */}
        <aside className="vip-no-print sticky top-[5.25rem] hidden h-[calc(100vh-6rem)] w-60 shrink-0 flex-col overflow-y-auto pb-4 lg:flex" aria-label="Clubhouse">
          <nav aria-label="Main" className="space-y-0.5">{main.map(railLink)}</nav>
          <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Explore</p>
          <nav aria-label="Explore" className="mt-1.5 space-y-0.5">{more.map(railLink)}</nav>

          {!viewer.suspended && spaces.length > 0 && (
            <div className="mt-6">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Spaces</p>
              <nav className="mt-1.5 space-y-0.5" aria-label="Spaces">
                {spaces.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/feed?space=${encodeURIComponent(s.slug)}`}
                    className="vip-focus block truncate rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-white/[0.04] hover:text-white"
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
            <a href={shopUrl} className="vip-focus flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/[0.04] hover:text-white">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              vitalityproject.global
            </a>
            {adminUrl && (
              <a href={adminUrl} className="vip-focus flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/[0.04] hover:text-white">
                <Shield className="h-4 w-4" aria-hidden="true" />
                Clubhouse admin
              </a>
            )}
            <div className="flex gap-3 px-3 pt-1 text-[11px] text-white/60">
              <Link href="/guidelines" className="hover:text-white/80">Guidelines</Link>
              <Link href="/privacy" className="hover:text-white/80">Privacy</Link>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="vip-focus flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/65 hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
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
        className="vip-no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#070b14]/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Clubhouse"
      >
        <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((n) => {
            const on = isActive(n, pathname)
            return (
              <Link
                key={n.key}
                href={n.href}
                aria-current={on ? 'page' : undefined}
                aria-label={navLabel(n, badges)}
                className={cn('vip-focus relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10.5px] font-medium', on ? 'text-brand-200' : 'text-white/60')}
              >
                {on && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-400" aria-hidden="true" />}
                <n.icon className="h-5 w-5" aria-hidden="true" />
                {n.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label={moreBadge ? `More, ${moreBadge} unread` : 'More'}
            className={cn('vip-focus relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10.5px] font-medium', moreActive ? 'text-brand-200' : 'text-white/60')}
          >
            {moreActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-400" aria-hidden="true" />}
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            More
            <Count n={moreBadge} className="absolute right-3 top-1.5" />
          </button>
        </div>
      </nav>

      {moreOpen && (
        <MoreSheet
          items={sheetItems}
          pathname={pathname}
          badges={badges}
          onClose={() => setMoreOpen(false)}
          viewer={viewer}
          shopUrl={shopUrl}
          adminUrl={adminUrl}
          onSignOut={signOut}
          signingOut={signingOut}
        />
      )}
    </div>
  )
}

function MoreSheet({
  items,
  pathname,
  badges,
  onClose,
  viewer,
  shopUrl,
  adminUrl,
  onSignOut,
  signingOut,
}: {
  items: VipNavItem[]
  pathname: string
  badges: Badges
  onClose: () => void
  viewer: ShellViewer
  shopUrl: string
  adminUrl: string | null
  onSignOut: () => void
  signingOut: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)

  const trap = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (f.length === 0) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    opener.current = document.activeElement
    panel.current?.querySelector<HTMLElement>('a[href], button')?.focus()
    document.addEventListener('keydown', trap)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', trap)
      document.body.style.overflow = prev
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [trap])

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="more-title">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm" aria-label="Close menu" tabIndex={-1} onClick={onClose} />
      <div
        ref={panel}
        className="vip-sheet absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0b1220] px-4 pb-6 pt-3"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id="more-title" className="text-lg font-bold">More</h2>
          <button type="button" onClick={onClose} className="vip-focus grid h-11 w-11 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06]" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {items.map((n) => {
            const on = isActive(n, pathname)
            const count = n.badge ? badges[n.badge] : 0
            return (
              <li key={n.key}>
                <Link
                  href={n.href}
                  aria-current={on ? 'page' : undefined}
                  aria-label={navLabel(n, badges)}
                  className={cn(
                    'vip-focus relative flex h-full min-h-[76px] flex-col justify-between gap-2 rounded-2xl border p-3.5',
                    on ? 'border-brand-400/40 bg-brand-500/15' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]',
                  )}
                >
                  <span className="flex items-center justify-between">
                    <n.icon className={cn('h-5 w-5', on ? 'text-brand-300' : 'text-white/70')} aria-hidden="true" />
                    <Count n={count} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{n.label}</span>
                    {n.hint && <span className="mt-0.5 block text-xs leading-snug text-white/60">{n.hint}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 space-y-1 border-t border-white/[0.08] pt-3">
          <div className="px-1 pb-1"><TierBadge tier={viewer.tier} admin={viewer.isAdmin} /></div>
          <a href={shopUrl} className="vip-focus flex min-h-[44px] items-center gap-3 rounded-xl px-2 text-sm text-white/75 hover:bg-white/[0.05]">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> vitalityproject.global
          </a>
          {adminUrl && (
            <a href={adminUrl} className="vip-focus flex min-h-[44px] items-center gap-3 rounded-xl px-2 text-sm text-white/75 hover:bg-white/[0.05]">
              <Shield className="h-4 w-4" aria-hidden="true" /> Clubhouse admin
            </a>
          )}
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="vip-focus flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 text-left text-sm text-white/75 hover:bg-white/[0.05] disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
          <div className="flex gap-4 px-2 pt-2 text-xs text-white/60">
            <Link href="/guidelines" className="vip-focus rounded hover:text-white">Guidelines</Link>
            <Link href="/privacy" className="vip-focus rounded hover:text-white">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
