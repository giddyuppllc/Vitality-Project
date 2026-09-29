export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TagsManager } from '@/components/admin/tags-manager'
import { Tag as TagIcon } from 'lucide-react'

export default async function AdminTagsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TagIcon className="w-6 h-6 text-brand-400" />
          Customer tags
        </h1>
        <p className="text-white/40 mt-1">
          Organize customers with tags — applied on the customer profile.
        </p>
      </div>

      <TagsManager
        initial={tags.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          userCount: t._count.users,
        }))}
      />
    </div>
  )
}
