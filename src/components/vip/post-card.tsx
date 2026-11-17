'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import {
  Ban, Bookmark, Flag, Heart, ImagePlus, Loader2, Megaphone, MessageCircle, MoreHorizontal, Pencil, Pin, Send, Trash2,
} from 'lucide-react'
import type { PostView } from '@/lib/vip/feed'
import { renderPostBody } from '@/lib/vip/text'
import { cn } from '@/lib/utils'
import { Avatar, TierBadge, timeAgo } from './ui'
import { ReportDialog } from './report-dialog'
import { ShareDialog } from './share-dialog'
import { PostImages, PostVideo } from './post-media'
import { MentionTextarea } from './mention-textarea'
import { ImageTray, MAX_POST_IMAGES } from './composer'
import { uploadVipImage } from './upload'

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
      className={cn(
        'vip-focus inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors',
        size === 'sm' ? 'px-1.5 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
        liked ? 'text-rose-300' : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
      )}
    >
      <Heart className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]', liked && 'fill-current')} aria-hidden="true" />
      <span className="sr-only">Like, </span>
      <span>{count}</span>
    </button>
  )
}

export function BookmarkButton({ postId, initial }: { postId: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)
  async function toggle() {
    if (busy) return
    setBusy(true)
    const want = !saved
    setSaved(want)
    const res = await fetch('/api/vip/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, saved: want }),
    }).catch(() => null)
    if (res?.ok) setSaved((await res.json()).saved)
    else setSaved(!want)
    setBusy(false)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Saved — remove from saved posts' : 'Save post'}
      className={cn(
        'vip-focus inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium',
        saved ? 'text-brand-200' : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
      )}
    >
      <Bookmark className={cn('h-[18px] w-[18px]', saved && 'fill-current')} aria-hidden="true" />
      <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
    </button>
  )
}

function PostEditor({
  post,
  onDone,
}: {
  post: PostView
  onDone: (next: { body: string; images: string[]; videoUrl: string | null } | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState(post.body)
  const [images, setImages] = useState(post.images)
  const [videoUrl, setVideoUrl] = useState(post.videoUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function addFiles(files: File[]) {
    const take = files.slice(0, Math.max(0, MAX_POST_IMAGES - images.length))
    if (take.length < files.length) setError(`Add up to ${MAX_POST_IMAGES} photos.`)
    setUploading((n) => n + take.length)
    await Promise.all(
      take.map(async (f) => {
        const r = await uploadVipImage(f)
        setUploading((n) => n - 1)
        if (r.ok) setImages((cur) => (cur.length < MAX_POST_IMAGES ? [...cur, r.url] : cur))
        else setError(r.error)
      }),
    )
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/vip/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, images, videoUrl: videoUrl.trim() || null }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Could not save.')
      return
    }
    onDone({ body: body.trim(), images, videoUrl: videoUrl.trim() || null })
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3" aria-label="Edit post">
      <label className="block">
        <span className="sr-only">Post text</span>
        <MentionTextarea
          value={body}
          onValueChange={setBody}
          rows={4}
          maxLength={5000}
          autoFocus
          className="vip-focus w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[15px] text-white"
        />
      </label>
      <ImageTray images={images} onRemove={(u) => setImages((cur) => cur.filter((x) => x !== u))} />
      <label className="block text-sm text-white/70">
        YouTube or Vimeo link
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className="vip-focus mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) addFiles(files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading > 0 || images.length >= MAX_POST_IMAGES}
          className="vip-focus inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
        >
          {uploading > 0 ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          Photos
        </button>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => onDone(null)} className="vip-focus rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/[0.06]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || uploading > 0 || !body.trim()}
            className="vip-focus inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save
          </button>
        </div>
      </div>
    </form>
  )
}

export function PostCard({
  post: initialPost,
  viewerId,
  linkToThread = true,
}: {
  post: PostView
  viewerId: string
  linkToThread?: boolean
}) {
  const router = useRouter()
  const [post, setPost] = useState(initialPost)
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const mine = post.author.id === viewerId

  async function remove() {
    setMenu(false)
    if (!confirm('Delete this post?')) return
    const res = await fetch(`/api/vip/posts/${post.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleted(true)
      if (!linkToThread) router.replace('/feed')
    }
  }

  async function block() {
    setMenu(false)
    if (!confirm(`Block ${post.author.displayName}? You won’t see each other’s posts, profile or messages.`)) return
    const res = await fetch(`/api/vip/members/${post.author.id}/block`, { method: 'POST' })
    if (res.ok) {
      setDeleted(true)
      if (!linkToThread) router.replace('/feed')
      else router.refresh()
    }
  }

  if (deleted) return null

  const profileHref = `/members/${post.author.id}`
  const itemCls = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]'
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
            <time dateTime={post.createdAt} suppressHydrationWarning>{timeAgo(post.createdAt)}</time>
            {post.space && (
              <>
                {' · '}
                <Link href={`/feed?space=${encodeURIComponent(post.space.slug)}`} className="hover:text-white/80">
                  # {post.space.name}
                </Link>
              </>
            )}
            {post.editedAt && (
              <>
                {' · '}
                <span title={`Edited ${new Date(post.editedAt).toLocaleString('en-US')}`}>edited</span>
              </>
            )}
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
            <div className="vip-surface-strong absolute right-0 z-20 mt-1 w-48 p-1 text-sm shadow-xl" role="menu">
              {mine ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false)
                      setEditing(true)
                    }}
                    className={itemCls}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                  </button>
                  <button type="button" role="menuitem" onClick={remove} className={cn(itemCls, 'text-red-200')}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false)
                      setReporting(true)
                    }}
                    className={itemCls}
                  >
                    <Flag className="h-4 w-4" aria-hidden="true" /> Report
                  </button>
                  {!post.author.isAdmin && (
                    <button type="button" role="menuitem" onClick={block} className={cn(itemCls, 'text-red-200')}>
                      <Ban className="h-4 w-4" aria-hidden="true" /> Block {post.author.displayName.split(/\s+/)[0]}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {editing ? (
        <PostEditor
          post={post}
          onDone={(next) => {
            setEditing(false)
            if (next) {
              setPost((p) => ({ ...p, ...next, imageUrl: next.images[0] ?? null, editedAt: new Date().toISOString() }))
              router.refresh()
            }
          }}
        />
      ) : (
        <>
          <div
            className="vip-body mt-3 text-[15px] text-white/90"
            dangerouslySetInnerHTML={{ __html: renderPostBody(post.body, { hashtags: true }) }}
          />
          <PostImages images={post.images} />
          {post.videoUrl && <PostVideo url={post.videoUrl} />}
        </>
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
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="vip-focus inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/55 hover:bg-white/[0.05] hover:text-white"
          >
            <Send className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Send</span>
          </button>
          <BookmarkButton postId={post.id} initial={post.bookmarkedByMe} />
        </div>
      </footer>

      {reporting && <ReportDialog target={{ postId: post.id }} onClose={() => setReporting(false)} />}
      {sharing && <ShareDialog postId={post.id} onClose={() => setSharing(false)} />}
    </article>
  )
}
