import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string; priority?: string }>
}

export default async function AdminSupportPage({ searchParams }: Props) {
  const { status, priority } = await searchParams

  // Validate URL params against the enums before they hit Prisma — an invalid
  // value (stale bookmark / typo) was throwing PrismaClientValidationError → 500.
  const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']
  const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
  const where: any = {}
  if (status && TICKET_STATUSES.includes(status)) where.status = status
  if (priority && TICKET_PRIORITIES.includes(priority)) where.priority = priority

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    include: {
      _count: { select: { messages: true } },
      user: { select: { name: true, email: true } },
    },
    take: 200,
  })

  const statusVariant = (s: string) =>
    s === 'RESOLVED' || s === 'CLOSED'
      ? 'success'
      : s === 'WAITING_CUSTOMER'
      ? 'warning'
      : s === 'IN_PROGRESS'
      ? 'info'
      : 'default'

  const priorityVariant = (p: string) =>
    p === 'URGENT' ? 'danger' : p === 'HIGH' ? 'warning' : 'default'

  const statusOptions = [
    '',
    'OPEN',
    'IN_PROGRESS',
    'WAITING_CUSTOMER',
    'RESOLVED',
    'CLOSED',
  ]
  const priorityOptions = ['', 'LOW', 'NORMAL', 'HIGH', 'URGENT']

  const mkHref = (next: { status?: string; priority?: string }) => {
    const params = new URLSearchParams()
    if (next.status ?? status) params.set('status', next.status ?? status ?? '')
    if (next.priority ?? priority)
      params.set('priority', next.priority ?? priority ?? '')
    const qs = params.toString().replace(/=(&|$)/g, '$1').replace(/^&+|&+$/g, '')
    return qs ? `/admin/support?${qs}` : '/admin/support'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-white/40 mt-1">{tickets.length} tickets</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-xs uppercase tracking-wider text-white/40">
          Status
        </span>
        {statusOptions.map((s) => (
          <Link
            key={s || 'all-s'}
            href={mkHref({ status: s })}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              (status ?? '') === s
                ? 'bg-brand-500/20 text-brand-400'
                : 'bg-dark-700 text-white/50 hover:text-white'
            }`}
          >
            {s || 'All'}
          </Link>
        ))}
        <span className="text-xs uppercase tracking-wider text-white/40 ml-4">
          Priority
        </span>
        {priorityOptions.map((p) => (
          <Link
            key={p || 'all-p'}
            href={mkHref({ priority: p })}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              (priority ?? '') === p
                ? 'bg-brand-500/20 text-brand-400'
                : 'bg-dark-700 text-white/50 hover:text-white'
            }`}
          >
            {p || 'All'}
          </Link>
        ))}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {[
                'Ticket',
                'Subject',
                'Customer',
                'Priority',
                'Status',
                'Messages',
                'Updated',
                '',
              ].map((h) => (
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
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4 font-mono text-xs text-brand-400">
                  {t.number}
                </td>
                <td className="px-5 py-4 text-sm font-medium truncate max-w-xs">
                  {t.subject}
                </td>
                <td className="px-5 py-4 text-sm">
                  <p className="font-medium">{t.user?.name ?? 'Guest'}</p>
                  <p className="text-xs text-white/40">{t.email}</p>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={priorityVariant(t.priority)}>
                    {t.priority}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {t._count.messages}
                </td>
                <td className="px-5 py-4 text-xs text-white/40">
                  {formatDate(t.updatedAt)}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/support/${t.id}`}
                    className="p-1.5 text-white/30 hover:text-white transition-colors inline-flex"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-16 text-center text-white/30 text-sm"
                >
                  No tickets match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
