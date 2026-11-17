import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { KIND_LABEL } from '@/lib/vip/catalog'
import { formatPrice } from '@/lib/utils'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'
import { OptionAdd, OptionEditor, RewardItemForm } from '@/components/admin/vip/rewards-forms'

export const dynamic = 'force-dynamic'

const API = '/api/admin/vip/rewards/catalog'

export default async function AdminRewardsCatalogPage() {
  await requireAdminPage()
  const [items, products, courses, counts] = await Promise.all([
    prisma.vipRewardItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { options: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } } }),
    prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'ARCHIVED', 'DRAFT'] } },
      orderBy: { name: 'asc' },
      take: 1000,
      select: { id: true, name: true, status: true, variants: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
    }),
    prisma.vipCourse.findMany({ orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }], select: { id: true, title: true } }),
    prisma.vipRedemption.groupBy({ by: ['itemId', 'status'], _count: { _all: true } }),
  ])
  const countFor = (id: string) => counts.filter((c) => c.itemId === id && c.status !== 'CANCELLED').reduce((n, c) => n + c._count._all, 0)
  const productName = new Map(products.map((p) => [p.id, p.name]))
  const courseName = new Map(courses.map((c) => [c.id, c.title]))
  const productChoices = products.map((p) => ({ ...p, status: String(p.status) }))

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_28rem]">
      <div className="space-y-4">
        <h2 className="font-semibold">Rewards catalog <span className="text-white/40">({items.length})</span></h2>
        {items.length === 0 && <p className="glass rounded-2xl p-5 text-sm text-white/40">No rewards yet. Create the first one on the right.</p>}
        {items.map((i) => (
          <details key={i.id} className="glass rounded-2xl p-5">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium">{i.title}</span>{' '}
                <span className="text-xs text-white/40">
                  · {KIND_LABEL[i.kind]} · {i.pointsCost.toLocaleString('en-US')} pts
                  {i.creditCents ? ` → ${formatPrice(i.creditCents)} credit` : ''}
                  {i.productId ? ` · ${productName.get(i.productId) ?? 'product'}` : ''}
                  {i.courseId ? ` · ${courseName.get(i.courseId) ?? 'course'}` : ''}
                  {' '}· {TIER_BENEFITS[i.minTier].label}+
                  {i.options.length
                    ? ` · sizes ${i.options.map((o) => `${o.label}:${o.stock ?? '∞'}`).join(' ')}`
                    : i.stock !== null
                      ? ` · stock ${i.stock}`
                      : ''}
                  {i.perMemberLimit ? ` · max ${i.perMemberLimit}/member` : ''} · {countFor(i.id)} redeemed
                </span>
              </span>
              <span className={i.active ? 'rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-200' : 'rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/50'}>
                {i.active ? 'Live' : 'Off'}
              </span>
            </summary>
            <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
              <RewardItemForm item={i} products={productChoices} courses={courses} />
              {i.kind === 'MERCH' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sizes &amp; stock</p>
                  {i.options.map((o) => (
                    <OptionEditor key={o.id} option={o} />
                  ))}
                  <OptionAdd itemId={i.id} />
                </div>
              )}
              {countFor(i.id) === 0 && (
                <AdminActionButton endpoint={API} tone="danger" label="Delete reward" confirmText="Delete this reward? (Rewards that were redeemed can only be switched off.)" body={{ op: 'delete', id: i.id }} />
              )}
            </div>
          </details>
        ))}
      </div>
      <div className="glass h-fit rounded-2xl p-5">
        <h2 className="mb-3 font-semibold">New reward</h2>
        <RewardItemForm products={productChoices} courses={courses} />
      </div>
    </div>
  )
}
