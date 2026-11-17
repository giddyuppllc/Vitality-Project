import Link from 'next/link'
import { PenSquare, Users } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listConversations } from '@/lib/vip/messages'
import { SOCIAL_COPY } from '@/lib/vip/social-copy'
import { Avatar, EmptyState, PageHeader, timeAgo } from '@/components/vip/ui'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Messages' }

const C = SOCIAL_COPY.messages

export default async function MessagesPage() {
  const viewer = await requireVipPage('community')
  const conversations = await listConversations(viewer)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={C.title} intro={C.intro}>
        <Link
          href="/messages/new"
          className="vip-focus inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <PenSquare className="h-4 w-4" aria-hidden="true" /> New message
        </Link>
      </PageHeader>
      {conversations.length === 0 ? (
        <EmptyState title={C.emptyTitle}>{C.emptyBody}</EmptyState>
      ) : (
        <ul className="vip-surface divide-y divide-white/[0.06]" aria-label="Conversations">
          {conversations.map((c) => {
            const other = c.others[0]
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className={cn('vip-focus flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03]', c.unread > 0 && 'bg-brand-500/[0.07]')}
                >
                  {c.isGroup ? (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06]" aria-hidden="true">
                      <Users className="h-5 w-5 text-white/80" />
                    </span>
                  ) : (
                    <Avatar name={other?.displayName ?? c.title} src={other?.avatarUrl} size={44} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={cn('truncate', c.unread > 0 ? 'font-bold text-white' : 'font-semibold text-white/90')}>{c.title}</span>
                      {c.lastMessage && (
                        <time dateTime={c.lastMessage.createdAt} className="ml-auto shrink-0 text-xs text-white/60">
                          {timeAgo(c.lastMessage.createdAt)}
                        </time>
                      )}
                    </span>
                    <span className={cn('mt-0.5 block truncate text-sm', c.unread > 0 ? 'text-white/85' : 'text-white/60')}>
                      {c.lastMessage ? `${c.lastMessage.mine ? 'You: ' : ''}${c.lastMessage.preview}` : C.threadEmpty}
                    </span>
                  </span>
                  {c.unread > 0 && (
                    <span className="grid min-w-[22px] place-items-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold leading-[22px] text-white">
                      <span className="sr-only">Unread messages: </span>
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
