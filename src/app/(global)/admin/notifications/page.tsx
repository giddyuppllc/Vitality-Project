import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  ShoppingCart,
  AlertTriangle,
  FileCheck,
  Package,
  LifeBuoy,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react'
import type { NotificationType } from '@prisma/client'
import { MarkAllReadButton, MarkOneReadLink } from './client-controls'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ filter?: 'unread' | 'all'; type?: string }>
}

const TYPE_META: Record<
  NotificationType,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: 'default' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  ORDER_NEW: { label: 'New Order', icon: ShoppingCart, tone: 'success' },
  ORDER_REFUND_REQUEST: { label: 'Refund Request', icon: RefreshCw, tone: 'warning' },
  APPLICATION_NEW: { label: 'New Application', icon: FileCheck, tone: 'info' },
  LOW_STOCK: { label: 'Low Stock', icon: AlertTriangle, tone: 'warning' },
  FULFILLMENT_DELAYED: { label: 'Fulfillment Delayed', icon: Package, tone: 'danger' },
  SUPPORT_TICKET_NEW: { label: 'Support Ticket', icon: LifeBuoy, tone: 'info' },
  SYSTEM: { label: 'System', icon: SettingsIcon, tone: 'default' },
}

export default async function AdminNotificationsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const sp = await searchParams
  const filter = sp.filter === 'unread' ? 'unread' : 'all'
  const typeFilter = sp.type as NotificationType | undefined

  const userId = session.user.id

  const [notifications, unreadCount, typeCounts] = await Promise.all([
    prisma.adminNotification.findMany({
      where: {
        ...(filter === 'unread' ? { NOT: { readBy: { has: userId } } } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.adminNotification.count({ where: { NOT: { readBy: { has: userId } } } }),
    prisma.adminNotification.groupBy({
      by: ['type'],
      where: { NOT: { readBy: { has: userId } } },
      _count: true,
    }),
  ])

  const countsByType = Object.fromEntries(
    typeCounts.map((t) => [t.type, t._count]),
  ) as Record<string, number>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" /> Notifications
          </h1>
          <p className="text-white/40 mt-1">
            {unreadCount} unread · {notifications.length} shown
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      {/* Filter row: unread/all + type chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <a
          href="/admin/notifications?filter=unread"
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            filter === 'unread'
              ? 'bg-brand-500/20 border-brand-500/40 text-white'
              : 'bg-dark-700 border-white/10 text-white/60 hover:text-white'
          }`}
        >
          Unread {unreadCount > 0 && <span className="ml-1 text-xs text-white/50">{unreadCount}</span>}
        </a>
        <a
          href="/admin/notifications?filter=all"
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            filter === 'all'
              ? 'bg-brand-500/20 border-brand-500/40 text-white'
              : 'bg-dark-700 border-white/10 text-white/60 hover:text-white'
          }`}
        >
          All
        </a>
        <span className="mx-1 text-white/20">|</span>
        {(Object.keys(TYPE_META) as NotificationType[]).map((t) => {
          const meta = TYPE_META[t]
          const c = countsByType[t] ?? 0
          if (c === 0 && typeFilter !== t) return null
          const params = new URLSearchParams()
          params.set('filter', filter)
          params.set('type', t)
          const Icon = meta.icon
          const active = typeFilter === t
          return (
            <a
              key={t}
              href={`/admin/notifications?${params.toString()}`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                active
                  ? 'bg-brand-500/20 border-brand-500/40 text-white'
                  : 'bg-dark-700 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
              {c > 0 && <span className="ml-0.5 text-white/40">{c}</span>}
            </a>
          )
        })}
        {typeFilter && (
          <a
            href={`/admin/notifications?filter=${filter}`}
            className="text-xs text-white/40 hover:text-white/70 ml-1"
          >
            clear type
          </a>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {notifications.length === 0 ? (
          <div className="px-6 py-16 text-center text-white/40">
            <Bell className="w-10 h-10 mx-auto mb-3 text-white/15" />
            <p>{filter === 'unread' ? 'Inbox zero — nothing unread.' : 'No notifications yet.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type]
              const Icon = meta.icon
              const isRead = n.readBy.includes(userId)
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                    isRead ? 'opacity-60 hover:opacity-100' : 'bg-brand-500/5'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      meta.tone === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : meta.tone === 'warning'
                          ? 'bg-amber-500/10 text-amber-400'
                          : meta.tone === 'danger'
                            ? 'bg-red-500/10 text-red-400'
                            : meta.tone === 'info'
                              ? 'bg-brand-500/10 text-brand-400'
                              : 'bg-white/5 text-white/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{n.title}</p>
                      <Badge variant={meta.tone}>{meta.label}</Badge>
                      {!isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                      )}
                    </div>
                    <p className="text-sm text-white/60 mt-1 leading-relaxed line-clamp-3">
                      {n.body}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="text-white/30">{formatDate(n.createdAt)}</span>
                      {n.link && (
                        <a
                          href={n.link}
                          className="text-brand-400 hover:text-brand-300"
                        >
                          Open →
                        </a>
                      )}
                      <MarkOneReadLink id={n.id} read={isRead} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
