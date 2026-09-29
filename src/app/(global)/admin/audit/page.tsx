import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{
    page?: string
    user?: string
    action?: string
    entityType?: string
    from?: string
    to?: string
  }>
}

export default async function AuditLogPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1') || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where: any = {}
  if (params.user) {
    where.OR = [
      { userEmail: { contains: params.user, mode: 'insensitive' } },
      { userId: params.user },
    ]
  }
  if (params.action) where.action = { contains: params.action }
  if (params.entityType) where.entityType = params.entityType
  if (params.from || params.to) {
    where.createdAt = {}
    if (params.from) where.createdAt.gte = new Date(params.from)
    if (params.to) {
      const end = new Date(params.to)
      end.setDate(end.getDate() + 1)
      where.createdAt.lt = end
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const qs = new URLSearchParams()
    const merged = { ...params, ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v) qs.set(k, v)
    }
    const s = qs.toString()
    return s ? `/admin/audit?${s}` : '/admin/audit'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-white/40 mt-1">
            {total} entries · page {page} of {totalPages}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="glass rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3">
        <input
          name="user"
          defaultValue={params.user ?? ''}
          placeholder="User email or id"
          className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm"
        />
        <input
          name="action"
          defaultValue={params.action ?? ''}
          placeholder="Action (e.g. order.refund)"
          className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm"
        />
        <input
          name="entityType"
          defaultValue={params.entityType ?? ''}
          placeholder="Entity type"
          className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm"
        />
        <input
          name="from"
          defaultValue={params.from ?? ''}
          type="date"
          className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm"
        />
        <div className="flex gap-2">
          <input
            name="to"
            defaultValue={params.to ?? ''}
            type="date"
            className="flex-1 px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {['When', 'User', 'Action', 'Entity', 'IP', 'Metadata'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-3 text-xs text-white/50 whitespace-nowrap">
                  {formatDate(log.createdAt)}
                </td>
                <td className="px-5 py-3 text-xs">
                  <p className="text-white/80">{log.userEmail ?? '—'}</p>
                  {log.userId && (
                    <p className="text-white/30 font-mono text-[10px]">
                      {log.userId.slice(0, 10)}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Badge variant="info" className="font-mono">
                    {log.action}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-xs text-white/60">
                  {log.entityType ? (
                    <>
                      <p>{log.entityType}</p>
                      {log.entityId && (
                        <p className="text-white/30 font-mono text-[10px]">
                          {log.entityId.slice(0, 16)}
                        </p>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-white/40 font-mono">
                  {log.ip ?? '—'}
                </td>
                <td className="px-5 py-3 text-xs text-white/40 max-w-md">
                  {log.metadata ? (
                    <pre className="whitespace-pre-wrap break-all text-[10px]">
                      {log.metadata.length > 200
                        ? log.metadata.slice(0, 200) + '…'
                        : log.metadata}
                    </pre>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-16 text-center text-white/30 text-sm"
                >
                  No audit entries match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Link
            href={buildHref({ page: String(Math.max(1, page - 1)) })}
            className={`px-4 py-2 rounded-lg bg-dark-700 text-sm ${
              page === 1
                ? 'opacity-40 pointer-events-none'
                : 'hover:bg-dark-600'
            }`}
          >
            Previous
          </Link>
          <span className="text-xs text-white/40">
            Page {page} of {totalPages}
          </span>
          <Link
            href={buildHref({ page: String(Math.min(totalPages, page + 1)) })}
            className={`px-4 py-2 rounded-lg bg-dark-700 text-sm ${
              page >= totalPages
                ? 'opacity-40 pointer-events-none'
                : 'hover:bg-dark-600'
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  )
}
