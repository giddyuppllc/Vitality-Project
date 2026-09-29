'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Flag, Loader2, Reply, Trash2 } from 'lucide-react'
import type { CommentView } from '@/lib/vip/feed'
import { renderPostBody } from '@/lib/vip/text'
import { Avatar, TierBadge, timeAgo } from './ui'
import { LikeButton } from './post-card'
import { ReportDialog } from './report-dialog'

export function CommentForm({
  postId,
  parentId,
  onDone,
  autoFocus,
  placeholder = 'Write a comment',
}: {
  postId: string
  parentId?: string
  onDone?: () => void
  autoFocus?: boolean
  placeholder?: string
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/vip/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, parentId }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Could not comment.')
      return
    }
    setBody('')
    onDone?.()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label>
        <span className="sr-only">{placeholder}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="vip-focus w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/40"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        {onDone && (
          <button type="button" onClick={onDone} className="vip-focus rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-white/[0.06]">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="vip-focus inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {parentId ? 'Reply' : 'Comment'}
        </button>
      </div>
    </form>
  )
}

function CommentItem({
  c,
  postId,
  viewerId,
  isReply,
}: {
  c: CommentView
  postId: string
  viewerId: string
  isReply?: boolean
}) {
  const router = useRouter()
  const [replying, setReplying] = useState(false)
  const [reporting, setReporting] = useState(false)
  const mine = c.author.id === viewerId

  async function remove() {
    if (!confirm('Delete this comment?')) return
    const res = await fetch(`/api/vip/comments/${c.id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  return (
    <li className={isReply ? 'mt-3' : ''}>
      <div className="flex gap-3">
        <Link href={`/members/${c.author.id}`} tabIndex={-1} aria-hidden="true">
          <Avatar name={c.author.displayName} src={c.author.avatarUrl} size={isReply ? 30 : 36} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-white/[0.045] px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={`/members/${c.author.id}`} className="text-sm font-semibold hover:underline">
                {c.author.displayName}
              </Link>
              <TierBadge tier={c.author.tier} admin={c.author.isAdmin} />
              {c.hidden && <span className="text-[11px] font-semibold text-amber-200">hidden</span>}
            </div>
            <div className="vip-body mt-1 text-sm text-white/85" dangerouslySetInnerHTML={{ __html: renderPostBody(c.body) }} />
          </div>
          <div className="mt-1 flex items-center gap-1 pl-1 text-xs text-white/45">
            <time dateTime={c.createdAt} className="mr-1">{timeAgo(c.createdAt)}</time>
            <LikeButton target={{ commentId: c.id }} initialLiked={c.likedByMe} initialCount={c.likeCount} size="sm" />
            <button type="button" onClick={() => setReplying((r) => !r)} className="vip-focus inline-flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-white/[0.05] hover:text-white">
              <Reply className="h-3.5 w-3.5" aria-hidden="true" /> Reply
            </button>
            {mine ? (
              <button type="button" onClick={remove} className="vip-focus inline-flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-white/[0.05] hover:text-white">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
              </button>
            ) : (
              <button type="button" onClick={() => setReporting(true)} className="vip-focus inline-flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-white/[0.05] hover:text-white">
                <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Report
              </button>
            )}
          </div>
          {replying && (
            <div className="mt-2">
              <CommentForm
                postId={postId}
                parentId={c.id}
                autoFocus
                placeholder={`Reply to ${c.author.displayName}`}
                onDone={() => setReplying(false)}
              />
            </div>
          )}
          {c.replies.length > 0 && (
            <ul className="mt-1 border-l border-white/[0.08] pl-3" aria-label={`Replies to ${c.author.displayName}`}>
              {c.replies.map((r) => (
                <CommentItem key={r.id} c={r} postId={postId} viewerId={viewerId} isReply />
              ))}
            </ul>
          )}
        </div>
      </div>
      {reporting && <ReportDialog target={{ commentId: c.id }} onClose={() => setReporting(false)} />}
    </li>
  )
}

export function CommentThread({
  postId,
  comments,
  viewerId,
}: {
  postId: string
  comments: CommentView[]
  viewerId: string
}) {
  return (
    <section aria-label="Comments" className="vip-surface mt-3 p-4 sm:p-5">
      <CommentForm postId={postId} />
      {comments.length > 0 ? (
        <ul className="mt-5 space-y-4">
          {comments.map((c) => (
            <CommentItem key={c.id} c={c} postId={postId} viewerId={viewerId} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-white/45">No comments yet.</p>
      )}
    </section>
  )
}
