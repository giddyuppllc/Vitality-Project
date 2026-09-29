import Link from 'next/link'
import { AtSign, MessageCircle, Reply } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { VIP_COPY } from '@/lib/vip/copy'
import { requireVipPage } from '@/lib/vip/page-gate'
import { Avatar, EmptyState, PageHeader, timeAgo } from '@/components/vip/ui'
import { MarkAllRead } from '@/components/vip/mark-all-read'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications' }

const TEXT = {
  COMMENT: { icon: MessageCircle, verb: 'commented on your post' },
  REPLY: { icon: Reply, verb: 'replied to your comment' },
  MENTION: { icon: AtSign, verb: 'mentioned you' },
} as const

export default async function NotificationsPage() {
  const viewer = await requireVipPage('community')
  const items = await prisma.vipNotification.findMany({
    where: { userId: viewer.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const actorIds = [...new Set(items.map((i) => i.actorId).filter(Boolean) as string[])]
  const actors = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, username: true, vipProfile: { select: { displayName: true, avatarUrl: true } } },
      })
    ).map((u) => [
      u.id,
      { name: u.vipProfile?.displayName || u.name || u.username || 'A member', avatar: u.vipProfile?.avatarUrl ?? null },
    ]),
  )
  const unread = items.filter((i) => !i.readAt).length

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications">{unread > 0 && <MarkAllRead />}</PageHeader>
      {items.length === 0 ? (
        <EmptyState title={VIP_COPY.empty.notifications.title}>{VIP_COPY.empty.notifications.body}</EmptyState>
      ) : (
        <ul className="vip-surface divide-y divide-white/[0.06]">
          {items.map((n) => {
            const kind = TEXT[n.type as keyof typeof TEXT] ?? TEXT.COMMENT
            const actor = n.actorId ? actors.get(n.actorId) : null
            const href = n.postId ? `/posts/${n.postId}` : '/feed'
            return (
              <li key={n.id}>
                <Link href={href} className={cn('vip-focus flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03]', !n.readAt && 'bg-brand-500/[0.07]')}>
                  <Avatar name={actor?.name ?? 'Member'} src={actor?.avatar} size={38} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-white/85">
                      <span className="font-semibold text-white">{actor?.name ?? 'A member'}</span> {kind.verb}
                    </p>
                    <p className="mt-0.5 text-xs text-white/45">{timeAgo(n.createdAt)}</p>
                  </div>
                  <kind.icon className="h-4 w-4 text-white/35" aria-hidden="true" />
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-brand-400" aria-label="unread" />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
