'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Flag, Heart, MessageCircle, MoreHorizontal, Pin, Megaphone, Trash2 } from 'lucide-react'
import type { PostView } from '@/lib/vip/feed'
import { renderPostBody } from '@/lib/vip/text'
import { cn } from '@/lib/utils'
import { Avatar, TierBadge, timeAgo } from './ui'
import { ReportDialog } from './report-dialog'

export function LikeButton({
  target,
  initialLiked,
  initialCount,
  size = 'md',
}: {
  target: { postId: string } | { commentId: string }
  initialLiked: boolean
  initialCount: number
  size?: 'sm' | 'md'
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    // optimistic
    setLiked(!liked)
    setCount((c) => c + (liked ? -1 : 1))
    try {
      const res = await fetch('/api/vip/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target),
      })
      if (res.ok) {
        const data = await res.json()
        setLiked(data.liked)
        setCount(data.count)
      } else {
        setLiked(liked)
        setCount(initialCount)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className={cn(
        'vip-focus inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors',
        size === 'sm' ? 'px-1.5 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
        liked ? 'text-rose-300' : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
      )}
    >
      <Heart className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]', liked && 'fill-current')} aria-hidden="true" />
      <span>{count}</span>
    </button>
  )
}

export function PostCard({
  post,
  viewerId,
  linkToThread = true,
}: {
  post: PostView
  viewerId: string
  linkToThread?: boolean
}) {
  const router = useRouter()
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const mine = post.author.id === viewerId

  async function remove() {
    if (!confirm('Delete this post?')) return
    const res = await fetch(`/api/vip/posts/${post.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleted(true)
      if (!linkToThread) router.replace('/feed')
    }
  }

  if (deleted) return null

  const profileHref = `/members/${post.author.id}`
  return (
    <article
      className={cn('vip-surface p-4 sm:p-5', post.isAnnouncement && 'border-brand-400/35 bg-brand-950/40')}
      aria-labelledby={`post-${post.id}-author`}
    >
      {(post.pinned || post.isAnnouncement) && (
        <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
          {post.pinned && (
            <span className="inline-flex items-center gap-1"><Pin className="h-3.5 w-3.5" aria-hidden="true" /> Pinned</span>
          )}
          {post.isAnnouncement && (
            <span className="inline-flex items-center gap-1"><Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> Announcement</span>
          )}
        </div>
      )}
      <header className="flex items-start gap-3">
        <Link href={profileHref} className="vip-focus rounded-full" tabIndex={-1} aria-hidden="true">
          <Avatar name={post.author.displayName} src={post.author.avatarUrl} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link id={`post-${post.id}-author`} href={profileHref} className="vip-focus truncate font-semibold hover:underline">
              {post.author.displayName}
            </Link>
            <TierBadge tier={post.author.tier} admin={post.author.isAdmin} />
          </div>
          <p className="mt-0.5 text-xs text-white/45">
            <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
            {post.space && (
              <>
                {' · '}
                <Link href={`/feed?space=${encodeURIComponent(post.space.slug)}`} className="hover:text-white/80">
                  # {post.space.name}
                </Link>
              </>
            )}
            {post.editedAt && ' · edited'}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="Post options"
            aria-expanded={menu}
            className="vip-focus grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          {menu && (
            <div className="vip-surface-strong absolute right-0 z-20 mt-1 w-44 p-1 text-sm shadow-xl" role="menu">
              {mine ? (
                <button type="button" role="menuitem" onClick={remove} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-200 hover:bg-white/[0.06]">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false)
                    setReporting(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]"
                >
                  <Flag className="h-4 w-4" aria-hidden="true" /> Report
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="vip-body mt-3 text-[15px] text-white/90" dangerouslySetInnerHTML={{ __html: renderPostBody(post.body) }} />

      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- members-only media route
        <img
          src={post.imageUrl}
          alt="Image shared by the member"
          loading="lazy"
          className="mt-3 max-h-[520px] w-full rounded-xl border border-white/10 object-cover"
        />
      )}

      <footer className="mt-3 flex items-center gap-1 border-t border-white/[0.06] pt-2">
        <LikeButton target={{ postId: post.id }} initialLiked={post.likedByMe} initialCount={post.likeCount} />
        {linkToThread ? (
          <Link
            href={`/posts/${post.id}`}
            className="vip-focus inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/55 hover:bg-white/[0.05] hover:text-white"
          >
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
            {post.commentCount}
            <span className="sr-only">comments</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-white/55">
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" /> {post.commentCount}
            <span className="sr-only">comments</span>
          </span>
        )}
      </footer>

      {reporting && <ReportDialog target={{ postId: post.id }} onClose={() => setReporting(false)} />}
    </article>
  )
}
