import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PostForm, type PostFormValues } from '@/components/admin/post-form'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: Props) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) notFound()

  const related = Array.isArray(post.relatedLinks)
    ? (post.relatedLinks as { href: string; label: string }[])
    : []

  const initial: Partial<PostFormValues> = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    readTime: post.readTime ?? '',
    coverImage: post.coverImage ?? '',
    authorName: post.authorName ?? '',
    relatedLinks: related,
    published: post.published,
  }

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin/blog" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white">
        <ChevronLeft className="w-4 h-4" /> Back to posts
      </Link>
      <h1 className="text-2xl font-bold">Edit post</h1>
      <PostForm initial={initial} />
    </div>
  )
}
