import Link from 'next/link'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { KIND_LABEL, STATUS_LABEL, parseShipping } from '@/lib/vip/catalog'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const API = '/api/admin/vip/rewards/redemptions'
const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'FULFILLED', label: 'Fulfilled' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'all', label: 'All' },
] as const

export default async function AdminRedemptionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage()
  const { status = 'open' } = await searchParams
  const where =
    status === 'open'
      ? { status: { in: ['REQUESTED' as const, 'APPROVED' as const] } }
      : ['REQUESTED', 'APPROVED', 'FULFILLED', 'CANCELLED'].includes(status)
        ? { status: status as 'REQUESTED' | 'APPROVED' | 'FULFILLED' | 'CANCELLED' }
        : {}
  const rows = await prisma.vipRedemption.findMany({
    where,
    orderBy: { createdAt: status === 'open' ? 'asc' : 'desc' },
    take: 200,
    include: { item: { select: { productId: true, variantId: true } } },
  })
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, email: true, name: true } })
  const byId = new Map(users.map((u) => [u.id, u]))
  const productIds = rows.map((r) => r.item.productId).filter((x): x is string => !!x)
  const variantIds = rows.map((r) => r.item.variantId).filter((x): x is string => !!x)
  const [products, variants] = await Promise.all([
    productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } }) : [],
    variantIds.length ? prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, name: true, sku: true } }) : [],
  ])
  const pmap = new Map(products.map((p) => [p.id, p]))
  const vmap = new Map(variants.map((v) => [v.id, v]))

  return (
    <div className="space-y-4">
      <nav aria-label="Filter" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/vip/rewards/redemptions?status=${f.key}`}
            aria-current={status === f.key ? 'page' : undefined}
            className={cn('rounded-lg px-3 py-1.5 text-xs', status === f.key ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:text-white')}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="glass rounded-2xl p-5 text-sm text-white/40">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const u = byId.get(r.userId)
            const ship = parseShipping(r.shippingAddress)
            const p = r.item.productId ? pmap.get(r.item.productId) : null
            const v = r.item.variantId ? vmap.get(r.item.variantId) : null
            return (
              <li key={r.id} className="glass rounded-2xl p-5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.title}
                      {r.optionLabel && <span className="text-white/60"> · size {r.optionLabel}</span>}
                    </p>
                    <p className="text-xs text-white/40">
                      {KIND_LABEL[r.kind]} · {r.pointsSpent.toLocaleString('en-US')} pts · {formatDate(r.createdAt)} · {u?.email ?? r.userId}
                      {u?.name ? ` (${u.name})` : ''}
                    </p>
                    {p && (
                      <p className="mt-1 text-xs text-white/60">
                        Ship from store: {p.name}
                        {v ? ` — ${v.name}` : ''} {v?.sku || p.sku ? `[${v?.sku ?? p.sku}]` : ''}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{STATUS_LABEL[r.status]}</span>
                </div>
                {ship && (
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-white/5 p-3 text-xs text-white/75">
                    {[ship.name, ship.line1, ship.line2, `${ship.city}, ${ship.state} ${ship.zip}`, ship.country, ship.phone].filter(Boolean).join('\n')}
                  </p>
                )}
                {r.memberNote && <p className="mt-2 text-xs text-white/70"><span className="text-white/40">Member note:</span> {r.memberNote}</p>}
                {r.adminNote && <p className="mt-1 text-xs text-white/70"><span className="text-white/40">Team note:</span> {r.adminNote}</p>}
                {r.trackingNumber && <p className="mt-1 text-xs text-white/70"><span className="text-white/40">Tracking:</span> {r.trackingNumber}</p>}
                {(r.status === 'REQUESTED' || r.status === 'APPROVED') && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === 'REQUESTED' && <AdminActionButton endpoint={API} tone="primary" label="Approve" body={{ op: 'approve', id: r.id }} />}
                    <AdminActionButton
                      endpoint={API}
                      tone="primary"
                      label={r.kind === 'EXPERIENCE' ? 'Mark done' : 'Mark fulfilled'}
                      body={{ op: 'fulfil', id: r.id }}
                      prompt={r.kind === 'EXPERIENCE' ? { field: 'note', question: 'Note (optional, e.g. session date)' } : { field: 'trackingNumber', question: 'Tracking number (optional)' }}
                    />
                    <AdminActionButton
                      endpoint={API}
                      tone="danger"
                      label="Cancel + return points"
                      confirmText={`Cancel and return ${r.pointsSpent.toLocaleString('en-US')} points to the member?`}
                      body={{ op: 'cancel', id: r.id }}
                      prompt={{ field: 'reason', question: 'Reason (kept in the audit log)' }}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
