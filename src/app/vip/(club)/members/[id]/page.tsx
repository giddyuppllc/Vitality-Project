import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getMemberCard } from '@/lib/vip/members'
import { Avatar, TierBadge, timeAgo } from '@/components/vip/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Member' }

/** Members-only profile. There is no public profile page anywhere. */
export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireVipPage('community')
  const { id } = await params
  const member = await getMemberCard(id)
  if (!member) notFound()

  const posts = await prisma.vipPost.findMany({
    where: { authorId: member.id, hiddenAt: null },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, body: true, createdAt: true, _count: { select: { comments: true, reactions: true } } },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/members" className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Members
      </Link>
      <section className="vip-surface-strong p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={member.displayName} src={member.avatarUrl} size={72} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{member.displayName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-white/50">
              <TierBadge tier={member.tier} admin={member.isAdmin} />
              {member.username && <span>@{member.username}</span>}
              {member.joinedAt && (
                <span>
                  Member since{' '}
                  {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                </span>
              )}
            </div>
          </div>
        </div>
        {member.bio && <p className="mt-4 whitespace-pre-line text-[15px] text-white/80">{member.bio}</p>}
        {member.id === viewer.userId && (
          <Link href="/profile" className="vip-focus mt-4 inline-block rounded-xl border border-white/15 px-3.5 py-2 text-sm font-medium hover:bg-white/[0.06]">
            Edit profile
          </Link>
        )}
      </section>

      <h2 className="mb-3 mt-7 text-lg font-semibold">Recent posts</h2>
      {posts.length === 0 ? (
        <p className="text-sm text-white/45">No posts yet.</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/posts/${p.id}`} className="vip-surface vip-focus block p-4 hover:bg-white/[0.04]">
                {/* plain text preview: a rendered body could nest links inside this link */}
                <p className="vip-body line-clamp-3 whitespace-pre-line text-sm text-white/85">{p.body}</p>
                <p className="mt-2 text-xs text-white/45">
                  {timeAgo(p.createdAt)} · {p._count.reactions} likes · {p._count.comments} comments
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
