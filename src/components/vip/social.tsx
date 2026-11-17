import Link from 'next/link'
import { Bookmark, Compass, Hash, Home, Users } from 'lucide-react'
import type { MemberCard } from '@/lib/vip/members'
import type { TagCount } from '@/lib/vip/hashtags'
import { cn } from '@/lib/utils'
import { Avatar, TierBadge } from './ui'
import { FollowButton } from './follow-button'

/** Community / Following / Saved / Discover — the feed's tab row. */
export function FeedTabs({ current }: { current: 'everyone' | 'following' | 'saved' | 'discover' }) {
  const tabs = [
    { key: 'everyone', href: '/feed', label: 'Everyone', icon: Home },
    { key: 'following', href: '/feed?tab=following', label: 'Following', icon: Users },
    { key: 'saved', href: '/saved', label: 'Saved', icon: Bookmark },
    { key: 'discover', href: '/discover', label: 'Discover', icon: Compass },
  ] as const
  return (
    <nav aria-label="Feeds" className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
      {tabs.map((t) => {
        const on = t.key === current
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'vip-focus flex items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-[13px] font-semibold sm:text-sm',
              on ? 'bg-brand-500/20 text-white ring-1 ring-inset ring-brand-400/30' : 'text-white/65 hover:bg-white/[0.04] hover:text-white',
            )}
          >
            <t.icon className={cn('hidden h-4 w-4 min-[400px]:block', on && 'text-brand-300')} aria-hidden="true" />
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** One member in a list, with an optional reason line and follow button. */
export function MemberRow({
  m,
  reason,
  following,
  showFollow = true,
}: {
  m: MemberCard
  reason?: string | null
  following?: boolean
  showFollow?: boolean
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link href={`/members/${m.id}`} className="vip-focus flex min-w-0 flex-1 items-center gap-3 rounded-xl">
        <Avatar name={m.displayName} src={m.avatarUrl} size={44} />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate font-semibold">{m.displayName}</span>
            <TierBadge tier={m.tier} admin={m.isAdmin} />
          </span>
          <span className="block truncate text-xs text-white/60">
            {[m.username ? `@${m.username}` : null, reason].filter(Boolean).join(' · ')}
          </span>
        </span>
      </Link>
      {showFollow && <FollowButton userId={m.id} name={m.displayName} initialFollowing={!!following} size="sm" />}
    </li>
  )
}

export function SuggestedMembers({
  members,
  title = 'Members to follow',
}: {
  members: (MemberCard & { reason?: string })[]
  title?: string
}) {
  if (!members.length) return null
  return (
    <section className="vip-surface" aria-labelledby="suggested-h">
      <h2 id="suggested-h" className="px-4 pb-1 pt-4 text-sm font-semibold text-white/85">{title}</h2>
      <ul className="divide-y divide-white/[0.06]">
        {members.map((m) => (
          <MemberRow key={m.id} m={m} reason={m.reason} />
        ))}
      </ul>
    </section>
  )
}

export function TagList({ tags, label }: { tags: TagCount[]; label: string }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label}>
      {tags.map((t) => (
        <li key={t.tag}>
          <Link
            href={`/tags/${t.tag}`}
            className="vip-focus inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-sm text-white/85 hover:border-brand-400/40 hover:text-white"
          >
            <Hash className="h-3.5 w-3.5 text-brand-300" aria-hidden="true" />
            {t.tag}
            <span className="text-xs text-white/60">{t.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
