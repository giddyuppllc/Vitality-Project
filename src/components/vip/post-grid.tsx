'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Heart, Images, Loader2, MessageCircle, PlayCircle } from 'lucide-react'
import type { PostView } from '@/lib/vip/feed'
import { timeAgo } from './ui'

/** A member's posts as a grid of tiles (first photo, or the opening words). */
export function PostGrid({
  initial,
  initialCursor,
  authorId,
}: {
  initial: PostView[]
  initialCursor: string | null
  authorId: string
}) {
  const [posts, setPosts] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [busy, setBusy] = useState(false)

  async function more() {
    if (!cursor) return
    setBusy(true)
    const res = await fetch(`/api/vip/posts?${new URLSearchParams({ author: authorId, cursor })}`)
    if (res.ok) {
      const data = await res.json()
      setPosts((p) => [...p, ...data.posts.filter((n: PostView) => !p.some((o) => o.id === n.id))])
      setCursor(data.nextCursor)
    }
    setBusy(false)
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {posts.map((p) => {
          const cover = p.images[0]
          const label = p.body.trim().replace(/\s+/g, ' ').slice(0, 80)
          return (
            <li key={p.id}>
              <Link
                href={`/posts/${p.id}`}
                aria-label={`Post from ${timeAgo(p.createdAt)}: ${label}`}
                className="vip-focus group relative block aspect-square overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f1729]"
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- members-only media route
                  <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                ) : (
                  <span className="vip-body line-clamp-6 block p-3 text-[13px] leading-snug text-white/85">{p.body}</span>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6 text-xs font-medium text-white">
                  <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden="true" />{p.likeCount}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{p.commentCount}</span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    {p.images.length > 1 && <Images className="h-3.5 w-3.5" aria-hidden="true" />}
                    {p.videoUrl && <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {cursor && (
        <div className="flex justify-center pt-3">
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
    </>
  )
}
