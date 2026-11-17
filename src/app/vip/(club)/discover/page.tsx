import { Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { blockedIdSet } from '@/lib/vip/blocks'
import { listMembers } from '@/lib/vip/members'
import { searchHashtags, trendingHashtags } from '@/lib/vip/hashtags'
import { suggestedMembers } from '@/lib/vip/social'
import { SOCIAL_COPY } from '@/lib/vip/social-copy'
import { EmptyState, PageHeader } from '@/components/vip/ui'
import { FeedTabs, MemberRow, SuggestedMembers, TagList } from '@/components/vip/social'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Discover' }

const C = SOCIAL_COPY.discover

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await requireVipPage('community')
  const q = ((await searchParams).q ?? '').trim().slice(0, 60)
  const hidden = await blockedIdSet(viewer.userId)
  const [members, tags, trending, suggested] = await Promise.all([
    q ? listMembers(q, { excludeIds: [...hidden, viewer.userId], take: 30 }) : Promise.resolve([]),
    q ? searchHashtags(q) : Promise.resolve([]),
    trendingHashtags({ days: 7, take: 12 }),
    q ? Promise.resolve([]) : suggestedMembers(viewer, 6),
  ])
  const followed = members.length
    ? new Set(
        (
          await prisma.vipFollow.findMany({
            where: { followerId: viewer.userId, followingId: { in: members.map((m) => m.id) } },
            select: { followingId: true },
          })
        ).map((f) => f.followingId),
      )
    : new Set<string>()

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={C.title} intro={C.intro} />
      <FeedTabs current="discover" />
      <form action="/discover" method="get" role="search" className="mb-5">
        <label className="relative block">
          <span className="sr-only">{C.searchLabel}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden="true" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={C.searchPlaceholder}
            className="vip-focus h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-sm text-white placeholder:text-white/40"
          />
        </label>
      </form>

      {q ? (
        <div className="space-y-6">
          <section aria-labelledby="d-tags">
            <h2 id="d-tags" className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/70">{C.tagsTitle}</h2>
            {tags.length ? <TagList tags={tags} label={C.tagsTitle} /> : <p className="text-sm text-white/60">{C.noTags}</p>}
          </section>
          <section aria-labelledby="d-members">
            <h2 id="d-members" className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/70">{C.membersTitle}</h2>
            {members.length ? (
              <ul className="vip-surface divide-y divide-white/[0.06]">
                {members.map((m) => (
                  <MemberRow key={m.id} m={m} following={followed.has(m.id)} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/60">{C.noMembers}</p>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="d-trending" className="vip-surface p-4">
            <h2 id="d-trending" className="mb-3 text-sm font-semibold text-white/85">{C.trendingTitle}</h2>
            {trending.length ? <TagList tags={trending} label={C.trendingTitle} /> : <p className="text-sm text-white/60">{C.trendingEmpty}</p>}
          </section>
          {suggested.length ? (
            <SuggestedMembers members={suggested} />
          ) : (
            <EmptyState title={C.allFollowedTitle}>{C.allFollowedBody}</EmptyState>
          )}
        </div>
      )}
    </div>
  )
}

