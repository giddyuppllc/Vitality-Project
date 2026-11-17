'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** Second-level tabs inside a clubhouse admin section (Rewards, Partners). */
export function AdminSubTabs({ tabs, label }: { tabs: { href: string; label: string; exact?: boolean }[]; label: string }) {
  const pathname = usePathname() || ''
  return (
    <nav aria-label={label} className="mb-5 flex flex-wrap gap-1.5">
      {tabs.map((t) => {
        const on = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn('rounded-lg px-3 py-1.5 text-sm', on ? 'bg-brand-500/20 text-white' : 'bg-white/5 text-white/60 hover:text-white')}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
