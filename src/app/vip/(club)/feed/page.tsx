import Link from 'next/link'
import { Search } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listFeed, listSpaces } from '@/lib/vip/feed'
import { PostCard } from '@/components/vip/post-card'
import { FeedList } from '@/components/vip/feed-list'
import { Composer } from '@/components/vip/composer'
import { EmptyState, PageHeader } from '@/components/vip/ui'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Community' }

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; q?: string }>
}) {
  const viewer = await requireVipPage('community')
  const { space, q } = await searchParams
  const [spaces, feed] = await Promise.all([listSpaces(), listFeed({ viewer, space, q })])
  const current = spaces.find((s) => s.slug === space) ?? null

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={q ? 'Search' : current ? `# ${current.name}` : 'Community'} />

      <form action="/feed" method="get" role="search" className="mb-4 md:hidden">
        <label className="relative block">
          <span className="sr-only">Search the community</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search posts"
            className="vip-focus h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-sm text-white placeholder:text-white/40"
          />
        </label>
      </form>

      {spaces.length > 0 && !q && (
        <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Spaces">
          {[{ slug: '', name: 'All' }, ...spaces].map((s) => {
            const on = (s.slug || null) === (space || null)
            return (
              <Link
                key={s.slug || 'all'}
                href={s.slug ? `/feed?space=${encodeURIComponent(s.slug)}` : '/feed'}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'vip-focus shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium',
                  on ? 'border-white/25 bg-white/[0.1] text-white' : 'border-white/10 text-white/60 hover:text-white',
                )}
              >
                {s.slug ? `# ${s.name}` : s.name}
              </Link>
            )
          })}
        </nav>
      )}

      {current?.description && <p className="mb-4 text-sm text-white/55">{current.description}</p>}

      {q ? (
        <p className="mb-4 text-sm text-white/60">
          Results for <span className="font-semibold text-white">“{q}”</span> ·{' '}
          <Link href="/feed" className="text-brand-300 hover:text-brand-200">clear</Link>
        </p>
      ) : (
        <div className="mb-4">
          <Composer
            viewerName={viewer.displayName}
            viewerAvatar={viewer.avatarUrl}
            spaces={spaces.map((s) => ({ id: s.id, name: s.name, adminOnly: s.adminOnly }))}
            defaultSpaceId={current && (!current.adminOnly || viewer.isAdmin) ? current.id : null}
            isAdmin={viewer.isAdmin}
          />
        </div>
      )}

      {feed.pinned.length > 0 && (
        <section aria-label="Pinned" className="mb-3 space-y-3">
          {feed.pinned.map((p) => (
            <PostCard key={p.id} post={p} viewerId={viewer.userId} />
          ))}
        </section>
      )}

      {feed.posts.length === 0 && feed.pinned.length === 0 ? (
        <EmptyState title={q ? 'No posts match that search.' : 'No posts yet.'}>
          {!q && 'Be the first to start a conversation.'}
        </EmptyState>
      ) : (
        <FeedList
          key={`${space ?? ''}|${q ?? ''}|${feed.posts[0]?.id ?? ''}|${feed.posts.length}`}
          initial={feed.posts}
          initialCursor={feed.nextCursor}
          query={{ space, q }}
          viewerId={viewer.userId}
        />
      )}
    </div>
  )
}
