import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { MembershipTier } from '@prisma/client'
import { videoEmbed } from '@/lib/vip/text'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { VIP_COPY, tierName } from '@/lib/vip/copy'
import { TierBadge } from '@/components/vip/ui'
import { FIT_COPY } from '@/lib/vip/fitness/copy'

/** Server-safe pieces shared by the Fitness pages. */

export function VideoBlock({ url, title }: { url: string | null | undefined; title: string }) {
  const v = videoEmbed(url)
  if (!v) return null
  if (v.kind === 'iframe') {
    return (
      <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
        <iframe
          src={v.src}
          title={`Video: ${title}`}
          className="h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      </div>
    )
  }
  return (
    <a href={v.href} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">
      Watch the video →
    </a>
  )
}

export function LockedNotice({ minTier, what }: { minTier: MembershipTier; what: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-4 text-sm text-white/70">
      <Lock className="h-4 w-4" aria-hidden="true" /> <TierBadge tier={minTier} />
      <span>
        This {what} opens at {tierName(minTier)}.
      </span>
      <a href={GLOBAL_LINKS.manageMembership()} className="font-semibold text-brand-300 hover:text-brand-200">
        {VIP_COPY.classroom.upgrade} →
      </a>
    </div>
  )
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/70">{children}</span>
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
      ← {children}
    </Link>
  )
}

export function WellnessNote() {
  return <p className="mt-8 text-xs leading-relaxed text-white/45">{FIT_COPY.wellnessNote}</p>
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between gap-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  )
}
