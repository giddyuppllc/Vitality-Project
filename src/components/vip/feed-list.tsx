'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { PostView } from '@/lib/vip/feed'
import { PostCard } from './post-card'

/**
 * Server renders the first page; this appends later pages from the JSON API
 * (/api/vip/posts by default, /api/vip/bookmarks for saved posts).
 */
export function FeedList({
  initial,
  initialCursor,
  query,
  viewerId,
  endpoint = '/api/vip/posts',
}: {
  initial: PostView[]
  initialCursor: string | null
  query: { space?: string; q?: string; tab?: string; tag?: string }
  viewerId: string
  endpoint?: string
}) {
  const [posts, setPosts] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [busy, setBusy] = useState(false)

  async function more() {
    if (!cursor) return
    setBusy(true)
    const sp = new URLSearchParams({ cursor })
    for (const [k, v] of Object.entries(query)) if (v) sp.set(k, v)
    const res = await fetch(`${endpoint}?${sp}`)
    if (res.ok) {
      const data = await res.json()
      setPosts((p) => [...p, ...data.posts.filter((n: PostView) => !p.some((o) => o.id === n.id))])
      setCursor(data.nextCursor)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewerId={viewerId} />
      ))}
      {cursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={more}
            disabled={busy}
            className="vip-focus inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2 text-sm font-medium text-white/75 hover:bg-white/[0.05]"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
