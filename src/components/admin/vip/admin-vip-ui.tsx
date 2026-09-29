'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Tabs across the clubhouse admin section. */
export function VipAdminTabs() {
  const pathname = usePathname() || ''
  const tabs = [
    { href: '/admin/vip', label: 'Moderation', exact: true },
    { href: '/admin/vip/members', label: 'Members' },
    { href: '/admin/vip/spaces', label: 'Spaces' },
    { href: '/admin/vip/classroom', label: 'Classroom' },
    { href: '/admin/vip/events', label: 'Events' },
    { href: '/admin/vip/rewards', label: 'Rewards' },
  ]
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-white/5 pb-px" aria-label="Clubhouse admin">
      {tabs.map((t) => {
        const on = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
              on ? 'border-brand-400 text-white' : 'border-transparent text-white/50 hover:text-white',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** A button that POSTs a JSON body to an admin endpoint, then refreshes. */
export function AdminActionButton({
  endpoint,
  body,
  label,
  confirmText,
  prompt,
  tone = 'default',
  method = 'POST',
}: {
  endpoint: string
  body: Record<string, unknown>
  label: string
  confirmText?: string
  /** Ask for a free-text reason, sent as body[prompt.field]. */
  prompt?: { field: string; question: string }
  tone?: 'default' | 'danger' | 'primary'
  method?: 'POST' | 'PUT' | 'PATCH'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (confirmText && !confirm(confirmText)) return
    let extra: Record<string, unknown> = {}
    if (prompt) {
      const v = window.prompt(prompt.question) ?? null
      if (v === null) return
      extra = { [prompt.field]: v }
    }
    setBusy(true)
    setError(null)
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...extra }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed')
      return
    }
    router.refresh()
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
          tone === 'danger' && 'bg-red-500/15 text-red-200 hover:bg-red-500/25',
          tone === 'primary' && 'bg-brand-500/20 text-brand-200 hover:bg-brand-500/30',
          tone === 'default' && 'bg-white/5 text-white/70 hover:bg-white/10',
        )}
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        {label}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </span>
  )
}

export const adminInput =
  'w-full px-3 py-2 rounded-xl bg-dark-700 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500'
