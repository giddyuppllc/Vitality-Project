import { requireVipPage } from '@/lib/vip/page-gate'
import { listBookmarks } from '@/lib/vip/feed'
import { SOCIAL_COPY } from '@/lib/vip/social-copy'
import { FeedList } from '@/components/vip/feed-list'
import { EmptyState, PageHeader } from '@/components/vip/ui'
import { FeedTabs } from '@/components/vip/social'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Saved posts' }

export default async function SavedPage() {
  const viewer = await requireVipPage('community')
  const saved = await listBookmarks({ viewer })
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={SOCIAL_COPY.saved.title} intro={SOCIAL_COPY.saved.intro} />
      <FeedTabs current="saved" />
      {saved.posts.length === 0 ? (
        <EmptyState title={SOCIAL_COPY.saved.emptyTitle}>{SOCIAL_COPY.saved.emptyBody}</EmptyState>
      ) : (
        <FeedList
          key={`${saved.posts[0]?.id}|${saved.posts.length}`}
          initial={saved.posts}
          initialCursor={saved.nextCursor}
          query={{}}
          endpoint="/api/vip/bookmarks"
          viewerId={viewer.userId}
        />
      )}
    </div>
  )
}
