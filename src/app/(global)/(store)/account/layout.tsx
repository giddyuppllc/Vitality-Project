'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  MapPin,
  Settings,
  Users,
  Heart,
  LogOut,
  Menu,
  X,
  Sparkles,
  MessageSquare,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/credits', label: 'Credits & Rewards', icon: Sparkles },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/settings', label: 'Settings', icon: Settings },
  { href: '/account/affiliate', label: 'Affiliate', icon: Users },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/support', label: 'Support', icon: MessageSquare },
]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden glass rounded-xl p-3 flex items-center gap-3 text-sm"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          Account Menu
        </button>

        {/* Sidebar */}
        <aside
          className={cn(
            'lg:w-64 shrink-0',
            mobileOpen ? 'block' : 'hidden lg:block'
          )}
        >
          <div className="glass rounded-2xl p-5 sticky top-28">
            {/* User info */}
            {session?.user && (
              <div className="mb-6 pb-5 border-b border-white/10">
                <p className="font-semibold truncate">
                  {session.user.name ?? 'My Account'}
                </p>
                <p className="text-sm text-white/40 truncate">{session.user.email}</p>
              </div>
            )}

            {/* Nav links */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.href, item.exact)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      active
                        ? 'bg-brand-500/20 text-brand-400'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}

              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 w-full"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
