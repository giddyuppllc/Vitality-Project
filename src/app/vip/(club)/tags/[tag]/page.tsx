import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listFeed } from '@/lib/vip/feed'
import { hashtagPostCount } from '@/lib/vip/hashtags'
import { normaliseTag } from '@/lib/vip/text'
import { SOCIAL_COPY } from '@/lib/vip/social-copy'
import { FeedList } from '@/components/vip/feed-list'
import { EmptyState, PageHeader } from '@/components/vip/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hashtag' }

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const viewer = await requireVipPage('community')
  const tag = normaliseTag(decodeURIComponent((await params).tag))
  if (!tag) notFound()
  const [feed, total] = await Promise.all([listFeed({ viewer, tag }), hashtagPostCount(tag)])
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/discover" className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Discover
      </Link>
      <PageHeader title={`#${tag}`}>
        <span className="text-sm text-white/60">{total === 1 ? '1 post' : `${total} posts`}</span>
      </PageHeader>
      {feed.posts.length === 0 ? (
        <EmptyState title={SOCIAL_COPY.tag.empty} />
      ) : (
        <FeedList
          key={`${tag}|${feed.posts[0]?.id}|${feed.posts.length}`}
          initial={feed.posts}
          initialCursor={feed.nextCursor}
          query={{ tag }}
          viewerId={viewer.userId}
        />
      )}
    </div>
  )
}
