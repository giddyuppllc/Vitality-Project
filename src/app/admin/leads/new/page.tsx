export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { NewLeadForm } from '@/components/admin/new-lead-form'
import { UserSquare } from 'lucide-react'

export default async function NewLeadPage() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true },
    orderBy: { email: 'asc' },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserSquare className="w-6 h-6 text-brand-400" /> New Lead
        </h1>
        <p className="text-white/40 mt-1">
          Add a new prospect to the sales pipeline
        </p>
      </div>
      <NewLeadForm admins={admins} />
    </div>
  )
}
