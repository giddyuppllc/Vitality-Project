import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Award, Lock, MapPin, MessageCircle, PenLine, UserPlus } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listFeed } from '@/lib/vip/feed'
import { listFollows, loadProfile, memberActivity } from '@/lib/vip/social'
import { dmPermission } from '@/lib/vip/messages'
import { SOCIAL_COPY } from '@/lib/vip/social-copy'
import { Avatar, TierBadge, timeAgo } from '@/components/vip/ui'
import { FollowButton } from '@/components/vip/follow-button'
import { MessageButton, ProfileMenu, UnblockButton } from '@/components/vip/profile-actions'
import { PostGrid } from '@/components/vip/post-grid'
import { MemberRow } from '@/components/vip/social'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Member' }

const P = SOCIAL_COPY.profile
type Tab = 'posts' | 'activity' | 'followers' | 'following'
const TABS: Tab[] = ['posts', 'activity', 'followers', 'following']

/** Members-only profile. There is no public profile page anywhere. */
export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const viewer = await requireVipPage('community')
  const { id } = await params
  const rawTab = (await searchParams).tab
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'posts'
  const profile = await loadProfile(viewer, id)
  if (!profile) notFound()
  const m = profile.card
  const base = `/members/${m.id}`

  if (profile.blockedByMe) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/members" className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Members
        </Link>
        <section className="vip-surface-strong flex flex-col items-center gap-3 p-8 text-center">
          <Avatar name={m.displayName} src={null} size={64} />
          <h1 className="text-xl font-bold">{m.displayName}</h1>
          <p className="font-semibold text-white/90">{P.blockedTitle}</p>
          <p className="max-w-sm text-sm text-white/65">{P.blockedBody}</p>
          <UnblockButton userId={m.id} name={m.displayName} />
        </section>
      </div>
    )
  }

  const canMessage = !profile.isSelf && (await dmPermission(viewer.userId, m.id)).ok
  const [posts, activity, people] = await Promise.all([
    profile.full && tab === 'posts' ? listFeed({ viewer, authorId: m.id }) : Promise.resolve(null),
    profile.full && tab === 'activity' ? memberActivity(viewer, m.id) : Promise.resolve(null),
    profile.full && (tab === 'followers' || tab === 'following') ? listFollows(viewer, m.id, tab) : Promise.resolve(null),
  ])

  const stat = (n: number, label: string, t: Tab | null) => {
    const inner = (
      <>
        <span className="block text-lg font-bold text-white">{n}</span>
        <span className="block text-xs text-white/65">{label}</span>
      </>
    )
    return profile.full && t ? (
      <Link href={`${base}?tab=${t}`} className="vip-focus rounded-xl px-3 py-1.5 text-center hover:bg-white/[0.05]">
        {inner}
      </Link>
    ) : (
      <div className="px-3 py-1.5 text-center">{inner}</div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/members" className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Members
      </Link>

      <section className="vip-surface-strong overflow-hidden" aria-labelledby="profile-name">
        <div className="relative h-32 bg-gradient-to-br from-brand-800/70 via-[#0f1729] to-[#16213a] sm:h-44">
          {profile.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- members-only media route
            <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-11 flex items-end justify-between gap-3">
            <span className="rounded-full ring-4 ring-[#0f1729]">
              <Avatar name={m.displayName} src={m.avatarUrl} size={88} />
            </span>
            <div className="flex flex-wrap items-start justify-end gap-2 pt-12">
              {profile.isSelf ? (
                <Link href="/profile" className="vip-focus inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 px-4 text-sm font-semibold hover:bg-white/[0.06]">
                  <PenLine className="h-4 w-4" aria-hidden="true" /> Edit profile
                </Link>
              ) : (
                <>
                  <FollowButton userId={m.id} name={m.displayName} initialFollowing={profile.followedByMe} refresh />
                  {canMessage && <MessageButton userId={m.id} name={m.displayName} />}
                  {!m.isAdmin && <ProfileMenu userId={m.id} name={m.displayName} blocked={false} />}
                </>
              )}
            </div>
          </div>

          <h1 id="profile-name" className="mt-3 text-2xl font-bold">{m.displayName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-white/65">
            <TierBadge tier={m.tier} admin={m.isAdmin} />
            {m.username && <span>@{m.username}</span>}
            {profile.followsMe && (
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-white/80">Follows you</span>
            )}
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {profile.location}
              </span>
            )}
            {m.joinedAt && (
              <span>
                Member since{' '}
                {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </span>
            )}
          </div>

          {m.bio && <p className="mt-4 whitespace-pre-line text-[15px] text-white/85">{m.bio}</p>}

          {profile.interests.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Interests">
              {profile.interests.map((t) => (
                <li key={t}>
                  <Link
                    href={`/discover?q=${encodeURIComponent(t)}`}
                    className="vip-focus inline-block rounded-full border border-brand-400/30 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-100 hover:border-brand-400/60"
                  >
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-1 border-t border-white/[0.07] pt-3">
            {stat(profile.stats.posts, profile.stats.posts === 1 ? 'Post' : 'Posts', 'posts')}
            {stat(profile.stats.followers, profile.stats.followers === 1 ? 'Follower' : 'Followers', 'followers')}
            {stat(profile.stats.following, 'Following', 'following')}
          </div>
        </div>
      </section>

      {!profile.full ? (
        <section className="vip-surface mt-4 flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Lock className="h-6 w-6 text-white/70" aria-hidden="true" />
          <p className="font-semibold text-white/90">{P.followersOnlyTitle}</p>
          <p className="max-w-sm text-sm text-white/65">{P.followersOnlyBody}</p>
        </section>
      ) : (
        <>
          <section className="vip-surface mt-4 p-4" aria-labelledby="badges-h">
            <h2 id="badges-h" className="flex items-center gap-2 text-sm font-semibold text-white/85">
              <Award className="h-4 w-4 vip-gold" aria-hidden="true" /> Badges
            </h2>
            {profile.badges.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.badges.map((b) => (
                  <li
                    key={b.badgeKey}
                    title={`Earned ${new Date(b.awardedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#d4b26a]/45 bg-[#d4b26a]/10 px-3 py-1 text-xs font-semibold text-[#ead7a8]"
                  >
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    {b.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-white/60">{profile.isSelf ? P.noBadgesSelf : P.noBadges}</p>
            )}
          </section>

          <nav aria-label="Profile sections" className="mt-5 flex gap-1 overflow-x-auto border-b border-white/[0.08] [scrollbar-width:none]">
            {TABS.map((t) => (
              <Link
                key={t}
                href={t === 'posts' ? base : `${base}?tab=${t}`}
                aria-current={tab === t ? 'page' : undefined}
                className={cn(
                  'vip-focus shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold capitalize',
                  tab === t ? 'border-brand-400 text-white' : 'border-transparent text-white/60 hover:text-white',
                )}
              >
                {t}
              </Link>
            ))}
          </nav>

          <div className="mt-4">
            {tab === 'posts' &&
              posts &&
              (posts.posts.length ? (
                <PostGrid initial={posts.posts} initialCursor={posts.nextCursor} authorId={m.id} />
              ) : (
                <p className="text-sm text-white/60">{P.noPosts}</p>
              ))}

            {tab === 'activity' &&
              activity &&
              (activity.length ? (
                <ul className="vip-surface divide-y divide-white/[0.06]">
                  {activity.map((a, i) => (
                    <li key={`${a.kind}-${a.at}-${i}`}>
                      {a.kind === 'follow' && a.target ? (
                        <Link href={`/members/${a.target.id}`} className="vip-focus flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03]">
                          <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
                          <span className="min-w-0 text-sm text-white/85">
                            Followed <span className="font-semibold text-white">{a.target.displayName}</span>
                            <span className="block text-xs text-white/60">{timeAgo(a.at)}</span>
                          </span>
                        </Link>
                      ) : (
                        <Link href={`/posts/${a.postId}`} className="vip-focus flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03]">
                          {a.kind === 'post' ? (
                            <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
                          ) : (
                            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
                          )}
                          <span className="min-w-0 text-sm text-white/85">
                            {a.kind === 'post' ? 'Posted' : 'Commented'}: <span className="text-white/75">{a.text}</span>
                            <span className="block text-xs text-white/60">{timeAgo(a.at)}</span>
                          </span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-white/60">{P.noActivity}</p>
              ))}

            {(tab === 'followers' || tab === 'following') &&
              people &&
              (people.length ? (
                <ul className="vip-surface divide-y divide-white/[0.06]">
                  {people.map((p) => (
                    <MemberRow key={p.id} m={p} following={p.followedByMe} showFollow={p.id !== viewer.userId} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-white/60">{tab === 'followers' ? P.noFollowers : P.noFollowing}</p>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
