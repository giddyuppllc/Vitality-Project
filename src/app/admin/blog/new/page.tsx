import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { PostForm } from '@/components/admin/post-form'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin/blog" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white">
        <ChevronLeft className="w-4 h-4" /> Back to posts
      </Link>
      <h1 className="text-2xl font-bold">New post</h1>
      <PostForm />
    </div>
  )
}
