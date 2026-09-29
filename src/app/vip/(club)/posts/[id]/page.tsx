import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getThread } from '@/lib/vip/feed'
import { PostCard } from '@/components/vip/post-card'
import { CommentThread } from '@/components/vip/comments'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Post' }

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireVipPage('community')
  const { id } = await params
  const thread = await getThread(viewer, id)
  if (!thread) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/feed" className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Community
      </Link>
      {thread.post.hidden && (
        <p className="mb-3 rounded-lg border border-amber-200/30 bg-amber-200/[0.06] px-3 py-2 text-sm text-amber-50">
          Hidden by moderation — only the team can see this post.
        </p>
      )}
      <PostCard post={thread.post} viewerId={viewer.userId} linkToThread={false} />
      <CommentThread postId={thread.post.id} comments={thread.comments} viewerId={viewer.userId} />
    </div>
  )
}
