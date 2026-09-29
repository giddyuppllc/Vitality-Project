import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { FileText, Plus } from 'lucide-react'
import { PostRowActions } from '@/components/admin/post-row-actions'

export const dynamic = 'force-dynamic'

export default async function AdminBlogPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const posts = await prisma.post.findMany({ orderBy: [{ createdAt: 'desc' }] })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold">Blog / Research</h1>
            <p className="text-sm text-white/40">{posts.length} posts</p>
          </div>
        </div>
        <Link
          href="/admin/blog/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-white/40">
          No posts yet. Click “New post” — or run the seed to import the legacy articles.
        </div>
      ) : (
        <div className="glass rounded-2xl divide-y divide-white/5">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/blog/${post.id}/edit`} className="font-medium hover:text-brand-400 truncate">
                    {post.title}
                  </Link>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                      post.published
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {post.published ? 'Live' : 'Draft'}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">
                  {post.category} · /{post.slug} ·{' '}
                  {post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt)}
                </p>
              </div>
              <Link
                href={`/blog/${post.slug}`}
                target="_blank"
                className="text-xs text-white/40 hover:text-white"
              >
                View
              </Link>
              <Link href={`/admin/blog/${post.id}/edit`} className="text-xs text-brand-400 hover:text-brand-300">
                Edit
              </Link>
              <PostRowActions id={post.id} title={post.title} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
