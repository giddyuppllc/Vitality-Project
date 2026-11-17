import { ExternalLink, MapPin, Store } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listDirectory } from '@/lib/vip/partners'
import { REWARDS_COPY as C } from '@/lib/vip/rewards-copy'
import { EmptyState } from '@/components/vip/ui'
import { PartnerCodeButton } from '@/components/vip/rewards/partner-code'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Partners' }

export default async function PartnersDirectoryPage() {
  const viewer = await requireVipPage('member')
  const [partners, acct] = await Promise.all([
    listDirectory(),
    prisma.loyaltyAccount.findUnique({ where: { userId: viewer.userId }, select: { points: true } }),
  ])
  const balance = acct?.points ?? 0
  return (
    <div>
      <h2 className="text-lg font-semibold">{C.partnersTitle}</h2>
      <p className="mb-4 mt-1 max-w-2xl text-sm text-white/60">{C.partnersIntro}</p>
      {partners.length === 0 ? (
        <EmptyState title={C.partnersEmpty.title}>{C.partnersEmpty.body}</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" data-testid="partner-directory">
          {partners.map((p) => (
            <li key={p.id} className="vip-surface flex flex-col p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]">
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-set logo (members-only media or https)
                    <img src={p.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-5 w-5 text-brand-200" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{p.name}</h3>
                  {p.category && <p className="text-xs text-white/55">{p.category}</p>}
                </div>
              </div>
              {p.description && <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-white/65">{p.description}</p>}
              <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {p.earnPointsPerDollar > 0 && (
                  <li className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-0.5 text-emerald-100">
                    Earn {p.earnPointsPerDollar} pts per $1
                  </li>
                )}
                <li className={p.allowRedemption ? 'rounded-full border border-brand-300/30 bg-brand-500/15 px-2.5 py-0.5 text-brand-100' : 'rounded-full border border-white/10 px-2.5 py-0.5 text-white/55'}>
                  {p.allowRedemption ? 'Spend points here' : 'Earn only'}
                </li>
              </ul>
              {(p.address || p.website) && (
                <div className="mt-3 space-y-1 text-sm text-white/65">
                  {p.address && (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-hidden="true" />
                      <span>{p.address}</span>
                    </p>
                  )}
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className="vip-focus inline-flex items-center gap-1.5 rounded text-brand-200 hover:text-brand-100">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" /> Visit website
                    </a>
                  )}
                </div>
              )}
              {p.allowRedemption && (
                <div className="mt-auto pt-4">
                  <PartnerCodeButton partnerId={p.id} partnerName={p.name} balance={balance} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
