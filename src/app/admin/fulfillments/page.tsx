export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Truck, Eye } from 'lucide-react'
import type { FulfillmentStatus } from '@prisma/client'

interface Props {
  searchParams: Promise<{ status?: string; facility?: string; q?: string }>
}

const STATUSES: FulfillmentStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'FAILED',
]

export default async function AdminFulfillmentsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const { status, facility, q } = await searchParams

  const where: {
    status?: FulfillmentStatus
    facilityId?: string
    order?: { orderNumber: { contains: string; mode: 'insensitive' } }
  } = {}
  if (status && STATUSES.includes(status as FulfillmentStatus)) {
    where.status = status as FulfillmentStatus
  }
  if (facility) {
    where.facilityId = facility
  }
  if (q && q.trim()) {
    where.order = { orderNumber: { contains: q.trim(), mode: 'insensitive' } }
  }

  const [fulfillments, facilities] = await Promise.all([
    prisma.fulfillment.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, email: true, total: true } },
        facility: { select: { name: true, city: true, state: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.facility.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const statusVariant = (s: string) =>
    s === 'DELIVERED' ? 'success' :
    s === 'SHIPPED' ? 'info' :
    s === 'CANCELLED' || s === 'FAILED' ? 'danger' :
    s === 'PROCESSING' || s === 'ACCEPTED' ? 'info' : 'warning'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="w-6 h-6 text-brand-400" />
          Fulfillments
        </h1>
        <p className="text-white/40 mt-1">{fulfillments.length} shown</p>
      </div>

      {/* Filters */}
      <form method="get" className="glass rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="text-xs font-medium text-white/60 block mb-1">Search Order</label>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Order number..."
            className="w-full px-4 py-2 rounded-xl bg-dark-700 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-white/60 block mb-1">Status</label>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="px-4 py-2 rounded-xl bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-white/60 block mb-1">Facility</label>
          <select
            name="facility"
            defaultValue={facility ?? ''}
            className="px-4 py-2 rounded-xl bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-sm font-medium transition-colors"
        >
          Filter
        </button>
      </form>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Order</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Facility</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Items</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Tracking</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Created</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {fulfillments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-white/30 text-sm">
                  No fulfillments match.
                </td>
              </tr>
            )}
            {fulfillments.map((f) => (
              <tr key={f.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4">
                  <p className="text-sm font-mono font-medium">{f.order.orderNumber}</p>
                  <p className="text-xs text-white/40">{f.order.email}</p>
                </td>
                <td className="px-5 py-4 text-sm">
                  <p>{f.facility.name}</p>
                  <p className="text-xs text-white/40">{f.facility.city}, {f.facility.state}</p>
                </td>
                <td className="px-5 py-4 text-sm">{f.items.length}</td>
                <td className="px-5 py-4">
                  <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                </td>
                <td className="px-5 py-4 text-xs font-mono text-white/50">
                  {f.trackingNumber ?? '—'}
                </td>
                <td className="px-5 py-4 text-sm text-white/40">{formatDate(f.createdAt)}</td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/fulfillments/${f.id}`}
                    className="p-1.5 text-white/30 hover:text-white transition-colors inline-flex"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
