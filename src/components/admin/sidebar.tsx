'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, ShoppingBag, Users, BarChart2,
  Settings, Tag, Truck, Link2, LogOut, Building2, Sparkles, Factory,
  MessageSquare, Star, FileSearch, Filter, Send, CheckSquare, Tags as TagsIcon,
  UserSquare, TrendingUp, FileText, Bell, Activity, Crown, ChevronDown,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { NotificationBell } from '@/components/admin/notification-bell'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
}

// The six things touched every day live up top, always visible. Everything else
// is kept (nothing removed) under a collapsible "More" so the sidebar reads at a
// glance instead of being a wall of 25 equal-looking links.
const PRIMARY: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/members', label: 'Members', icon: Crown },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/support', label: 'Support', icon: MessageSquare },
]

const MORE: NavItem[] = [
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/fulfillments', label: 'Fulfillments', icon: Truck },
  { href: '/admin/coa', label: 'Certificates (CoA)', icon: FileText },
  { href: '/admin/facilities', label: 'Facilities', icon: Factory },
  { href: '/admin/leads', label: 'Leads', icon: UserSquare },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/campaigns', label: 'Campaigns', icon: Send },
  { href: '/admin/segments', label: 'Segments', icon: Filter },
  { href: '/admin/affiliates', label: 'Affiliates', icon: Link2 },
  { href: '/admin/discounts', label: 'Discounts', icon: Tag },
  { href: '/admin/credits', label: 'Credits & Loyalty', icon: Sparkles },
  { href: '/admin/tags', label: 'Tags', icon: TagsIcon },
  { href: '/admin/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/admin/insights', label: 'Insights', icon: TrendingUp },
  { href: '/admin/shipping', label: 'Shipping', icon: Truck },
  { href: '/admin/audit', label: 'Audit Log', icon: FileSearch },
  { href: '/admin/cron-status', label: 'Cron Status', icon: Activity },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

export function AdminSidebar() {
  const pathname = usePathname()
  const inMore = MORE.some((i) => isActive(pathname, i))
  const [moreOpen, setMoreOpen] = useState(inMore)

  // If you navigate to a page that lives under "More", open the section so the
  // current page is always visible and highlighted — never hidden.
  useEffect(() => {
    if (inMore) setMoreOpen(true)
  }, [inMore])

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item)
    return (
      <Link
        key={item.href}
        href={item.href}
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
  }

  return (
    <aside className="w-60 shrink-0 border-r border-white/5 bg-dark-800 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-white/5 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold uppercase tracking-widest text-white/40 mb-0.5">Admin</div>
          <div className="font-bold text-gradient">VITALITY PROJECT</div>
        </div>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {PRIMARY.map(renderItem)}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="mt-3 flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
        >
          <span>More</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', moreOpen ? '' : '-rotate-90')} />
        </button>
        {moreOpen ? <div className="space-y-1">{MORE.map(renderItem)}</div> : null}
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
  )
}
