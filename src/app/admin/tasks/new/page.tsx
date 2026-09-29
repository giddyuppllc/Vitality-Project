export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskForm } from '@/components/admin/task-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Props {
  searchParams: Promise<{ entityType?: string; entityId?: string }>
}

export default async function NewTaskPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const sp = await searchParams

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  })

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/tasks"
        className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All tasks
      </Link>
      <h1 className="text-2xl font-bold mb-6">Create task</h1>
      <TaskForm
        admins={admins}
        initialEntityType={sp.entityType ?? ''}
        initialEntityId={sp.entityId ?? ''}
        currentAdminId={session.user.id}
      />
    </div>
  )
}
