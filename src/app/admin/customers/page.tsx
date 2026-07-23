import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Download, ChevronRight } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { CustomerSearchBar } from '@/components/admin/customer-search-bar'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

type Segment = 'all' | 'new' | 'vip' | 'at-risk' | 'affiliates'

interface Props {
  searchParams: Promise<{ segment?: string; q?: string }>
}

function parseSegment(raw?: string): Segment {
  switch (raw) {
    case 'new':
    case 'vip':
    case 'at-risk':
    case 'affiliates':
      return raw
    default:
      return 'all'
  }
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  const sp = await searchParams
  const segment = parseSegment(sp?.segment)
  const q = (sp?.q ?? '').trim()

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY)

  let where: Prisma.UserWhereInput = {
    role: { in: ['CUSTOMER', 'AFFILIATE'] },
  }

  if (segment === 'new') {
    where = { ...where, createdAt: { gte: thirtyDaysAgo } }
  } else if (segment === 'affiliates') {
    where = { role: 'AFFILIATE' }
  } else if (segment === 'at-risk') {
    where = {
      ...where,
      orders: {
        some: { paymentStatus: 'PAID' },
        none: { paymentStatus: 'PAID', createdAt: { gte: ninetyDaysAgo } },
      },
    }
  }

  // Free-text search across name, email, and username — AND-ed onto the
  // active segment so you can search within a tab.
  if (q) {
    where = {
      ...where,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ],
    }
  }

  const baseCustomers = await prisma.user.findMany({
    where,
    include: {
      _count: { select: { orders: true } },
      orders: {
        where: { paymentStatus: 'PAID' },
        select: { total: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  // Load assigned tags for the rendered customer list
  const userIds = baseCustomers.map((c) => c.id)
  const userTagRows = userIds.length
    ? await prisma.userTag.findMany({
        where: { userId: { in: userIds } },
        include: { tag: true },
      })
    : []
  const tagsByUser = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >()
  for (const row of userTagRows) {
    const list = tagsByUser.get(row.userId) ?? []
    list.push({ id: row.tag.id, name: row.tag.name, color: row.tag.color })
    tagsByUser.set(row.userId, list)
  }

  let customers = baseCustomers
  if (segment === 'vip') {
    customers = baseCustomers.filter(
      (c) => c.orders.reduce((sum, o) => sum + o.total, 0) >= 200000
    )
  }

  // Counts
  const [total, newCount, affiliateCount, atRiskCount] = await Promise.all([
    prisma.user.count({ where: { role: { in: ['CUSTOMER', 'AFFILIATE'] } } }),
    prisma.user.count({
      where: { role: { in: ['CUSTOMER', 'AFFILIATE'] }, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.user.count({ where: { role: 'AFFILIATE' } }),
    prisma.user.count({
      where: {
        role: { in: ['CUSTOMER', 'AFFILIATE'] },
        orders: {
          some: { paymentStatus: 'PAID' },
          none: { paymentStatus: 'PAID', createdAt: { gte: ninetyDaysAgo } },
        },
      },
    }),
  ])
  const vipRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM (
       SELECT u.id, COALESCE(SUM(o.total), 0) AS ltv
       FROM users u
       LEFT JOIN orders o ON o."userId" = u.id AND o."paymentStatus" = 'PAID'
       WHERE u.role IN ('CUSTOMER', 'AFFILIATE')
       GROUP BY u.id
       HAVING COALESCE(SUM(o.total), 0) >= 200000
     ) t`
  )
  const vipCount = Number(vipRows[0]?.count ?? 0)

  const tabs: { key: Segment; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'new', label: 'New (<30d)', count: newCount },
    { key: 'vip', label: 'VIP ($2k+)', count: vipCount },
    { key: 'at-risk', label: 'At-Risk (90d+)', count: atRiskCount },
    { key: 'affiliates', label: 'Affiliates', count: affiliateCount },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-white/40 mt-1">{customers.length} shown · {total} total</p>
        </div>
        <a
          href="/api/admin/customers/export"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Search */}
      <div className="mb-4">
        <CustomerSearchBar defaultValue={q} />
      </div>

      {/* Segment tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => {
          const active = segment === t.key
          const usp = new URLSearchParams()
          if (t.key !== 'all') usp.set('segment', t.key)
          if (q) usp.set('q', q)
          const href = `/admin/customers${usp.toString() ? `?${usp}` : ''}`
          return (
            <Link
              key={t.key}
              href={href}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                active
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border-white/10'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  active ? 'bg-white/20' : 'bg-white/10'
                }`}
              >
                {t.count}
              </span>
            </Link>
          )
        })}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Name</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Email</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Role</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Tags</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Orders</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Lifetime Value</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Joined</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {customers.map((c) => {
              const ltv = c.orders.reduce((sum, o) => sum + o.total, 0)
              const assignedTags = tagsByUser.get(c.id) ?? []
              return (
                <tr key={c.id} className="hover:bg-white/2 transition-colors group">
                  <td className="px-5 py-4 text-sm font-medium">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="hover:text-brand-400 transition-colors"
                    >
                      {c.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="hover:text-brand-400 transition-colors"
                    >
                      {c.email}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={c.role === 'ADMIN' ? 'info' : c.role === 'AFFILIATE' ? 'success' : 'default'}>
                      {c.role}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {assignedTags.slice(0, 2).map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{
                            backgroundColor: `${t.color}20`,
                            color: t.color,
                            border: `1px solid ${t.color}40`,
                          }}
                        >
                          {t.name}
                        </span>
                      ))}
                      {assignedTags.length > 2 && (
                        <span className="text-[10px] text-white/40 self-center">
                          +{assignedTags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">{c._count.orders}</td>
                  <td className="px-5 py-4 text-sm font-medium">
                    {ltv > 0 ? `$${(ltv / 100).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-4 text-sm text-white/40">{formatDate(c.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white/40 hover:text-brand-400 hover:bg-white/5 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-white/30 text-sm">
                  {q
                    ? `No customers match "${q}".`
                    : 'No customers match this segment.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
