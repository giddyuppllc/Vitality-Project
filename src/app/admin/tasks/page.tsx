export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TaskRowActions } from '@/components/admin/task-row-actions'
import { CheckSquare, Plus, AlertTriangle, User as UserIcon } from 'lucide-react'
import type { Prisma } from '@prisma/client'

interface Props {
  searchParams: Promise<{
    status?: string
    priority?: string
    assignee?: string
  }>
}

const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const

export default async function AdminTasksPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const sp = await searchParams
  const statusFilter = STATUSES.includes(sp.status as (typeof STATUSES)[number])
    ? (sp.status as (typeof STATUSES)[number])
    : undefined
  const priorityFilter = PRIORITIES.includes(
    sp.priority as (typeof PRIORITIES)[number],
  )
    ? (sp.priority as (typeof PRIORITIES)[number])
    : undefined

  const assigneeFilter = sp.assignee

  const now = new Date()

  // Core lists
  const myWhere: Prisma.AdminTaskWhereInput = {
    assignedTo: session.user.id,
    status: { in: ['PENDING', 'IN_PROGRESS'] },
  }
  const [myTasks, overdueTasks, admins, totalOpen] = await Promise.all([
    prisma.adminTask.findMany({
      where: myWhere,
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
      take: 20,
    }),
    prisma.adminTask.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueAt: { lt: now },
      },
      orderBy: { dueAt: 'asc' },
      take: 20,
    }),
    prisma.user.findMany({
      where: { role: 'ADMIN' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    }),
    prisma.adminTask.count({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
    }),
  ])

  // Filtered table
  const where: Prisma.AdminTaskWhereInput = {}
  if (statusFilter) where.status = statusFilter
  if (priorityFilter) where.priority = priorityFilter
  if (assigneeFilter === 'me') where.assignedTo = session.user.id
  else if (assigneeFilter) where.assignedTo = assigneeFilter

  // Default to open tasks when no status filter
  if (!statusFilter) {
    where.status = { in: ['PENDING', 'IN_PROGRESS'] }
  }

  const tasks = await prisma.adminTask.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })

  // Entity name lookup (best effort for User/Order)
  const userIds = tasks
    .filter((t) => t.entityType === 'User' && t.entityId)
    .map((t) => t.entityId!)
  const orderIds = tasks
    .filter((t) => t.entityType === 'Order' && t.entityId)
    .map((t) => t.entityId!)
  const [userLookup, orderLookup] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    orderIds.length
      ? prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, orderNumber: true },
        })
      : Promise.resolve([]),
  ])
  const userMap = new Map(userLookup.map((u) => [u.id, u]))
  const orderMap = new Map(orderLookup.map((o) => [o.id, o]))
  const adminMap = new Map(admins.map((a) => [a.id, a]))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-brand-400" />
            Tasks
          </h1>
          <p className="text-white/40 mt-1">
            {totalOpen} open · {myTasks.length} assigned to you ·{' '}
            {overdueTasks.length} overdue
          </p>
        </div>
        <Link
          href="/admin/tasks/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New task
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* My Tasks */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <UserIcon className="w-4 h-4 text-brand-400" /> My tasks
          </h2>
          {myTasks.length === 0 ? (
            <p className="text-sm text-white/30">Nothing assigned to you.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {myTasks.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-white/40">
                      {t.dueAt
                        ? `Due ${formatDate(t.dueAt)}`
                        : 'No due date'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      t.priority === 'URGENT' || t.priority === 'HIGH'
                        ? 'danger'
                        : 'info'
                    }
                  >
                    {t.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue */}
        <div className="glass rounded-2xl p-5 border border-red-500/20">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Overdue
          </h2>
          {overdueTasks.length === 0 ? (
            <p className="text-sm text-white/30">Nothing overdue. 🙌</p>
          ) : (
            <div className="divide-y divide-white/5">
              {overdueTasks.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-red-400">
                      Due {formatDate(t.dueAt!)}
                    </p>
                  </div>
                  <Badge variant="danger">{t.priority}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterPill
          label="Status"
          value={statusFilter ?? 'open'}
          options={[
            { label: 'Open', value: 'open' },
            ...STATUSES.map((s) => ({ label: s, value: s })),
          ]}
          param="status"
          currentParams={sp}
        />
        <FilterPill
          label="Priority"
          value={priorityFilter ?? 'any'}
          options={[
            { label: 'Any', value: 'any' },
            ...PRIORITIES.map((p) => ({ label: p, value: p })),
          ]}
          param="priority"
          currentParams={sp}
        />
        <FilterPill
          label="Assignee"
          value={assigneeFilter ?? 'any'}
          options={[
            { label: 'Any', value: 'any' },
            { label: 'Me', value: 'me' },
            ...admins.map((a) => ({
              label: a.name ?? a.email,
              value: a.id,
            })),
          ]}
          param="assignee"
          currentParams={sp}
        />
      </div>

      {/* All Tasks Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                Task
              </th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                Related
              </th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                Assignee
              </th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                Due
              </th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tasks.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-white/30 text-sm"
                >
                  No tasks match these filters.
                </td>
              </tr>
            )}
            {tasks.map((t) => {
              const overdue =
                t.dueAt &&
                t.dueAt < now &&
                t.status !== 'COMPLETED' &&
                t.status !== 'CANCELLED'
              let relatedCell: React.ReactNode = '—'
              if (t.entityType === 'User' && t.entityId) {
                const u = userMap.get(t.entityId)
                relatedCell = u ? (
                  <Link
                    href={`/admin/customers/${u.id}`}
                    className="text-brand-400 hover:text-brand-300 text-xs"
                  >
                    {u.name ?? u.email}
                  </Link>
                ) : (
                  <span className="text-xs text-white/40">User {t.entityId.slice(0, 8)}</span>
                )
              } else if (t.entityType === 'Order' && t.entityId) {
                const o = orderMap.get(t.entityId)
                relatedCell = o ? (
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-brand-400 hover:text-brand-300 text-xs"
                  >
                    {o.orderNumber}
                  </Link>
                ) : (
                  <span className="text-xs text-white/40">Order {t.entityId.slice(0, 8)}</span>
                )
              } else if (t.entityType) {
                relatedCell = (
                  <span className="text-xs text-white/40">
                    {t.entityType} {t.entityId?.slice(0, 8) ?? ''}
                  </span>
                )
              }
              const assignee = t.assignedTo ? adminMap.get(t.assignedTo) : null
              return (
                <tr key={t.id} className="hover:bg-white/2">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-1">
                        {t.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">{relatedCell}</td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={
                        t.priority === 'URGENT' || t.priority === 'HIGH'
                          ? 'danger'
                          : t.priority === 'LOW'
                            ? 'default'
                            : 'info'
                      }
                    >
                      {t.priority}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/60">
                    {assignee ? assignee.name ?? assignee.email : '—'}
                  </td>
                  <td
                    className={`px-5 py-3 text-xs ${overdue ? 'text-red-400 font-medium' : 'text-white/50'}`}
                  >
                    {t.dueAt ? formatDate(t.dueAt) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={
                        t.status === 'COMPLETED'
                          ? 'success'
                          : t.status === 'IN_PROGRESS'
                            ? 'info'
                            : t.status === 'CANCELLED'
                              ? 'default'
                              : 'warning'
                      }
                    >
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <TaskRowActions taskId={t.id} status={t.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilterPill({
  label,
  value,
  options,
  param,
  currentParams,
}: {
  label: string
  value: string
  options: { label: string; value: string }[]
  param: string
  currentParams: Record<string, string | undefined>
}) {
  // Build a dropdown of links preserving other params
  return (
    <div className="relative group">
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-white/70"
      >
        <span className="text-white/40">{label}:</span> {value}
      </button>
      <div className="absolute left-0 mt-1 hidden group-hover:block group-focus-within:block bg-dark-800 border border-white/10 rounded-xl p-1 min-w-[140px] z-10 shadow-xl">
        {options.map((opt) => {
          const next = new URLSearchParams()
          for (const [k, v] of Object.entries(currentParams)) {
            if (v && k !== param) next.set(k, v)
          }
          if (opt.value !== 'any' && opt.value !== 'open') {
            next.set(param, opt.value)
          }
          const qs = next.toString()
          return (
            <Link
              key={opt.value}
              href={qs ? `/admin/tasks?${qs}` : '/admin/tasks'}
              className="block px-3 py-1.5 rounded-lg text-xs hover:bg-white/5 text-white/80"
            >
              {opt.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
