import Link from 'next/link'
import { Maximize2 } from 'lucide-react'
import { encodeQr, qrSvgPath } from '@/lib/vip/qr'
import { Monogram } from '../monogram'

/** The member number as a scannable QR (inline SVG, dark on white with a quiet zone). */
export function QrCode({ value, size = 160, label }: { value: string; size?: number; label: string }) {
  const qr = encodeQr(value)
  const dim = qr.size + 8
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      className="block rounded-xl bg-white"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={qrSvgPath(qr)} fill="#070b14" />
    </svg>
  )
}

/** Member card: what a member shows at a partner business. */
export function MemberCard({
  name,
  tierLabel,
  memberNumber,
  memberNumberRaw,
  compact = false,
}: {
  name: string
  tierLabel: string
  memberNumber: string
  memberNumberRaw: string
  compact?: boolean
}) {
  return (
    <section
      aria-label="Member card"
      className="vip-premium relative overflow-hidden rounded-[22px] border p-5"
      style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #0b1220 55%, #1a1608 130%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Monogram size={28} />
            <span className="vip-kicker">Member card</span>
          </div>
          <p className="mt-4 truncate text-lg font-bold">{name}</p>
          <p className="vip-gold-soft text-sm font-medium">{tierLabel}</p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/55">Member number</p>
          <p className="font-mono text-lg font-semibold tracking-wider" data-testid="member-number">{memberNumber}</p>
        </div>
        <div className="shrink-0">
          <QrCode value={memberNumberRaw} size={compact ? 108 : 128} label={`QR code for member number ${memberNumber}`} />
        </div>
      </div>
      {!compact && (
        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3 text-xs text-white/60">
          <span>Show this at partner businesses to earn and spend points.</span>
          <Link href="/rewards/card" className="vip-focus inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-brand-200 hover:bg-white/[0.06]">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Full screen
          </Link>
        </div>
      )}
    </section>
  )
}
