'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/rewards', label: 'Overview', exact: true },
  { href: '/rewards/catalog', label: 'Redeem' },
  { href: '/rewards/redemptions', label: 'My redemptions' },
  { href: '/rewards/partners', label: 'Partners' },
  { href: '/rewards/leaderboard', label: 'Leaderboard' },
]

/** Sub-navigation across the rewards pages (one "Rewards" entry in the main nav). */
export function RewardsTabs() {
  const pathname = usePathname() || ''
  return (
    <nav aria-label="Rewards" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
        {TABS.map((t) => {
          const on = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'vip-focus block whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                  on ? 'bg-brand-500/20 text-white ring-1 ring-inset ring-brand-400/30' : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
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
