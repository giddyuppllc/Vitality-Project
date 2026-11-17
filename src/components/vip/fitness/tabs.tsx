'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/fitness', label: 'Today', exact: true },
  { href: '/fitness/programs', label: 'Programs' },
  { href: '/fitness/exercises', label: 'Exercises' },
  { href: '/fitness/history', label: 'History' },
  { href: '/fitness/health', label: 'Health' },
  { href: '/fitness/challenges', label: 'Challenges' },
  { href: '/fitness/lifestyle', label: 'Lifestyle' },
]

/** Section tabs across every Fitness page (scrolls sideways on a phone). */
export function FitnessTabs() {
  const pathname = usePathname() || ''
  return (
    <nav aria-label="Fitness" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max gap-1.5">
        {TABS.map((t) => {
          const on = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'vip-focus inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors',
                  on ? 'border-brand-400/40 bg-brand-500/20 text-white' : 'border-white/10 text-white/60 hover:bg-white/[0.05] hover:text-white',
                )}
              >
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
