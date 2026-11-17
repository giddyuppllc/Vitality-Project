import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

/**
 * Customer-facing notice surfacing the all-sales-final policy. Used at
 * checkout, in the cart, and on product detail pages so the rule is
 * visible before commitment — and so support can reference exactly
 * where it was disclosed when buyers ask later.
 *
 * Two visual modes:
 *   - default: full callout with title + body. Use on cart/checkout.
 *   - variant="compact": single line with link. Use on product pages.
 */
interface Props {
  variant?: 'default' | 'compact'
  className?: string
}

export function NoRefundsNotice({ variant = 'default', className }: Props) {
  if (variant === 'compact') {
    return (
      <p className={`text-xs text-white/55 ${className ?? ''}`}>
        <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5 text-amber-400/70" />
        All sales are final — no refunds.{' '}
        <Link href="/shipping" className="text-brand-400/70 hover:text-brand-300 underline">
          Policy
        </Link>
      </p>
    )
  }

  return (
    <div
      className={`rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 ${className ?? ''}`}
      role="note"
      aria-label="Refund policy"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm leading-relaxed">
          <p className="font-semibold text-white mb-1">All sales are final — no refunds, no exceptions</p>
          <p className="text-white/65">
            We do not issue refunds under any circumstances, including shipping delays, carrier
            issues, or change of mind. The only remedy we offer is a replacement product when
            your order arrives with damaged packaging — contact us within 7 days of delivery with
            photos.
          </p>
          <p className="text-white/50 mt-2 text-xs">
            By completing this order you acknowledge and agree to our{' '}
            <Link href="/shipping" className="text-brand-400 hover:text-brand-300 underline">
              shipping &amp; refund policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="text-brand-400 hover:text-brand-300 underline">
              terms of service
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
