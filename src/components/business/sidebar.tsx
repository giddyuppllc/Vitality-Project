'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, MapPin, Users, UserPlus, DollarSign,
  Settings, LogOut, Building2, Menu, X,
} from 'lucide-react'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/business', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/business/locations', label: 'Locations', icon: MapPin },
  { href: '/business/staff', label: 'Staff', icon: Users },
  { href: '/business/clients', label: 'Clients', icon: UserPlus },
  { href: '/business/commissions', label: 'Commissions', icon: DollarSign },
  { href: '/business/settings', label: 'Settings', icon: Settings },
]

interface BusinessSidebarProps {
  orgName: string
}

export function BusinessSidebar({ orgName }: BusinessSidebarProps) {
  const pathname = usePathname()
  // Mobile drawer state. Ignored on desktop (lg+) where the sidebar is in-flow.
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close the drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [drawerOpen])

  return (
    <>
      {/* ── Mobile top bar (below lg) ──────────────────────────────────── */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-dark-800/95 backdrop-blur border-b border-white/5">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open business menu"
          aria-expanded={drawerOpen}
          className="-ml-2 p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-all"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 leading-none">Business</div>
          <div className="font-bold text-gradient text-sm leading-tight truncate">{orgName}</div>
        </div>
      </div>

      {/* Overlay behind the drawer (below lg only) */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'w-60 shrink-0 border-r border-white/5 bg-dark-800 flex flex-col',
          'fixed inset-y-0 left-0 z-50 max-w-[85vw] transition-transform duration-300 ease-out',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:translate-x-0 lg:z-auto lg:max-w-none lg:min-h-screen'
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-brand-400 shrink-0" />
              <div className="text-sm font-bold uppercase tracking-widest text-white/40">Business</div>
            </div>
            <div className="font-bold text-gradient truncate">{orgName}</div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close business menu"
            className="lg:hidden -mr-2 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm text-white/40 hover:text-red-400 hover:bg-white/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
