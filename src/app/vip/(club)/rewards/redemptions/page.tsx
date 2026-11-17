import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { KIND_LABEL, STATUS_LABEL } from '@/lib/vip/catalog'
import { REWARDS_COPY as C } from '@/lib/vip/rewards-copy'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/vip/ui'
import { CancelRedemptionButton } from '@/components/vip/rewards/cancel-redemption'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My redemptions' }

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const STATUS_TONE = {
  REQUESTED: 'border-amber-200/30 bg-amber-200/[0.08] text-amber-100',
  APPROVED: 'border-brand-300/40 bg-brand-500/15 text-brand-100',
  FULFILLED: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100',
  CANCELLED: 'border-white/15 bg-white/[0.04] text-white/60',
} as const

export default async function MyRedemptionsPage() {
  const viewer = await requireVipPage('member')
  const rows = await prisma.vipRedemption.findMany({ where: { userId: viewer.userId }, orderBy: { createdAt: 'desc' }, take: 100 })
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{C.redemptionsTitle}</h2>
      {rows.length === 0 ? (
        <EmptyState title={C.redemptionsEmpty.title}>{C.redemptionsEmpty.body}</EmptyState>
      ) : (
        <ul className="space-y-3" data-testid="my-redemptions">
          {rows.map((r) => (
            <li key={r.id} className="vip-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.title}
                    {r.optionLabel && <span className="font-normal text-white/60"> · {r.optionLabel}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-white/55">
                    {KIND_LABEL[r.kind]} · {r.pointsSpent.toLocaleString('en-US')} points · {day(r.createdAt)}
                  </p>
                </div>
                <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_TONE[r.status])}>{STATUS_LABEL[r.status]}</span>
              </div>
              {(r.trackingNumber || r.fulfilledAt || r.memberNote) && (
                <dl className="mt-3 grid gap-1 text-sm text-white/70">
                  {r.memberNote && (
                    <div>
                      <dt className="inline text-white/50">Your note: </dt>
                      <dd className="inline whitespace-pre-line">{r.memberNote}</dd>
                    </div>
                  )}
                  {r.fulfilledAt && r.status === 'FULFILLED' && (
                    <div>
                      <dt className="inline text-white/50">Completed: </dt>
                      <dd className="inline">{day(r.fulfilledAt)}</dd>
                    </div>
                  )}
                  {r.trackingNumber && (
                    <div>
                      <dt className="inline text-white/50">Tracking: </dt>
                      <dd className="inline font-mono">{r.trackingNumber}</dd>
                    </div>
                  )}
                </dl>
              )}
              {r.status === 'REQUESTED' && (
                <div className="mt-3 flex justify-end">
                  <CancelRedemptionButton id={r.id} points={r.pointsSpent} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
