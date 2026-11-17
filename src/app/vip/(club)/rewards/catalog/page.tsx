import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listCatalog } from '@/lib/vip/catalog'
import { REWARDS_COPY as C } from '@/lib/vip/rewards-copy'
import { EmptyState } from '@/components/vip/ui'
import { CatalogGrid, type AddressView } from '@/components/vip/rewards/catalog-grid'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Redeem points' }

export default async function RewardsCatalogPage() {
  const viewer = await requireVipPage('member')
  const [items, acct, address] = await Promise.all([
    listCatalog(viewer),
    prisma.loyaltyAccount.findUnique({ where: { userId: viewer.userId }, select: { points: true } }),
    // Prefill shipped rewards with the member's saved .global address.
    prisma.address.findFirst({ where: { userId: viewer.userId }, orderBy: [{ isDefault: 'desc' }] }),
  ])
  const balance = acct?.points ?? 0
  const addr: AddressView | null = address
    ? {
        name: address.name,
        line1: address.line1,
        line2: address.line2 ?? '',
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
        phone: address.phone ?? '',
      }
    : null

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{C.catalogTitle}</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">{C.catalogIntro}</p>
        </div>
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm">
          <span className="text-white/60">Balance</span> <span className="font-bold" data-testid="catalog-balance">{balance.toLocaleString('en-US')} pts</span>
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState title={C.catalogEmpty.title}>{C.catalogEmpty.body}</EmptyState>
      ) : (
        <CatalogGrid items={items} balance={balance} address={addr} />
      )}
    </div>
  )
}
