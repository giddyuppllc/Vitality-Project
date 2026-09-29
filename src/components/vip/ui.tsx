import type { MembershipTier } from '@prisma/client'
import { cn } from '@/lib/utils'
import { TIER_BENEFITS } from '@/lib/membership-tiers'

/**
 * Small presentational pieces shared by the clubhouse pages (server-safe).
 */

/**
 * Text wordmark. PLACEHOLDER for Kevin's 09-21 "VP" monogram — the two PNGs
 * he sent are email attachments and are not in the repo. Swap this for the
 * asset once it is committed under public/.
 */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="The Vitality Project Clubhouse">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-[13px] font-black tracking-tight text-white"
      >
        VP
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            The Vitality Project
          </span>
          <span className="block text-sm font-bold text-white">Clubhouse</span>
        </span>
      )}
    </span>
  )
}

const TIER_STYLE: Record<MembershipTier, string> = {
  NONE: 'border-white/10 text-white/50',
  CLUB: 'border-white/20 bg-white/[0.06] text-white/80',
  PLUS: 'border-brand-400/40 bg-brand-500/15 text-brand-200',
  PREMIUM: 'border-amber-200/40 bg-amber-200/10 text-amber-100',
}

export function TierBadge({ tier, admin, className }: { tier: MembershipTier; admin?: boolean; className?: string }) {
  if (admin) {
    return (
      <span className={cn('inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100', className)}>
        Team
      </span>
    )
  }
  if (tier === 'NONE') return null
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', TIER_STYLE[tier], className)}>
      {TIER_BENEFITS[tier].label}
    </span>
  )
}

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '•'
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/15 bg-gradient-to-br from-brand-700/60 to-dark-700 font-semibold text-white/90', className)}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size / 2.8)) }}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- members-only media route, not optimisable by next/image
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}

/** Clearly marked slot for copy Kevin/Edward have not supplied yet. */
export function CopyPlaceholder({ slot, text, className }: { slot: string; text: string | null; className?: string }) {
  if (text) return <p className={className}>{text}</p>
  return (
    <p
      className={cn('rounded-lg border border-dashed border-amber-200/40 bg-amber-200/[0.04] px-3 py-2 text-xs font-medium text-amber-100/80', className)}
      data-copy-slot={slot}
    >
      Copy needed — {slot} (to be supplied by Kevin / Edward)
    </p>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="vip-surface px-6 py-10 text-center">
      <p className="font-semibold text-white/90">{title}</p>
      {children && <div className="mt-2 text-sm text-white/55">{children}</div>}
    </div>
  )
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
      {children}
    </div>
  )
}

export function timeAgo(iso: string | Date, now = Date.now()): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime()
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
