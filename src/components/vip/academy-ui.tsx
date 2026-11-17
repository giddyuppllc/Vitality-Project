import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Presentational pieces for the Academy, Library, Events and Home (server-safe). */

export function ProgressRing({
  pct,
  size = 56,
  stroke = 5,
  label,
  className,
  children,
}: {
  pct: number
  size?: number
  stroke?: number
  /** Accessible name, e.g. "Course progress". */
  label: string
  className?: string
  children?: React.ReactNode
}) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      className={cn('relative inline-grid shrink-0 place-items-center', p >= 100 && 'vip-ring-done', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="vip-ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * p) / 100}
          className="vip-ring-value"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold" aria-hidden="true">
        {children ?? `${p}%`}
      </span>
    </span>
  )
}

export function Bar({ pct, label, className }: { pct: number; label: string; className?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div
      className={cn('h-1.5 overflow-hidden rounded-full bg-white/[0.08]', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full', p >= 100 ? 'bg-emerald-300' : 'bg-brand-400')} style={{ width: `${p}%` }} />
    </div>
  )
}

export function Pill({ children, tone = 'default', className }: { children: React.ReactNode; tone?: 'default' | 'blue' | 'gold' | 'green' | 'amber'; className?: string }) {
  const tones = {
    default: 'border-white/15 bg-white/[0.05] text-white/80',
    blue: 'border-brand-400/35 bg-brand-500/15 text-brand-100',
    gold: 'border-[#d4b26a]/45 bg-[#d4b26a]/10 text-[#ead7a8]',
    green: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/40 bg-amber-300/10 text-amber-100',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', tones[tone], className)}>{children}</span>
}

export function SectionHead({ title, href, linkLabel, id }: { title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="text-base font-semibold tracking-tight">{title}</h2>
      {href && (
        <Link href={href} className="vip-focus inline-flex min-h-[32px] items-center gap-1 rounded-lg text-sm font-medium text-brand-300 hover:text-brand-200">
          {linkLabel ?? 'See all'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export const LEVEL_LABEL: Record<string, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' }

export function minutesLabel(m: number | null | undefined): string | null {
  if (!m) return null
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export function formatPoints(n: number): string {
  return n.toLocaleString('en-US')
}
