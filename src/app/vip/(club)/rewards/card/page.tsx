import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { formatMemberNumber, getOrCreateMemberCard } from '@/lib/vip/member-card'
import { TIER_BENEFITS } from '@/lib/membership'
import { QrCode } from '@/components/vip/rewards/member-card'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Member card' }

/** Big, bright QR for the counter: easy to scan from a phone held at arm's length. */
export default async function MemberCardPage() {
  const viewer = await requireVipPage('member')
  const card = await getOrCreateMemberCard(viewer.userId)
  const number = formatMemberNumber(card.memberNumber)
  return (
    <div className="mx-auto max-w-sm">
      <Link href="/rewards" className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/65 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to rewards
      </Link>
      <section className="rounded-3xl bg-white p-6 text-center text-[#070b14] shadow-2xl" aria-label="Member card for scanning">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#16447f]">The Vitality Project</p>
        <p className="mt-1 text-lg font-bold">{viewer.displayName}</p>
        <p className="text-sm text-[#5b6476]">{viewer.isAdmin && viewer.tier === 'NONE' ? 'Vitality team' : TIER_BENEFITS[viewer.tier].label}</p>
        <div className="mx-auto mt-5 w-fit">
          <QrCode value={card.memberNumber} size={248} label={`QR code for member number ${number}`} />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5b6476]">Member number</p>
        <p className="font-mono text-2xl font-bold tracking-wider" data-testid="member-number-large">{number}</p>
      </section>
      <p className="mt-4 text-center text-sm text-white/60">Turn your screen brightness up if the scanner struggles.</p>
    </div>
  )
}
