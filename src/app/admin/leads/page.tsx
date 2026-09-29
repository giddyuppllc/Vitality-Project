export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { LeadsBoard } from '@/components/admin/leads-board'
import Link from 'next/link'
import { UserSquare, BarChart2 } from 'lucide-react'

export default async function AdminLeadsPage() {
  const [leads, admins] = await Promise.all([
    prisma.salesLead.findMany({
      orderBy: [{ stage: 'asc' }, { updatedAt: 'desc' }],
      take: 1000,
    }),
    prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true },
      orderBy: { email: 'asc' },
    }),
  ])

  const serializable = leads.map((l) => ({
    id: l.id,
    businessName: l.businessName,
    contactName: l.contactName,
    contactEmail: l.contactEmail,
    contactPhone: l.contactPhone,
    source: l.source,
    stage: l.stage,
    priority: l.priority,
    estimatedValue: l.estimatedValue,
    probability: l.probability,
    assignedTo: l.assignedTo,
    nextAction: l.nextAction,
    nextActionDue: l.nextActionDue ? l.nextActionDue.toISOString() : null,
    notes: l.notes,
    organizationId: l.organizationId,
    closedAt: l.closedAt ? l.closedAt.toISOString() : null,
    updatedAt: l.updatedAt.toISOString(),
  }))

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserSquare className="w-6 h-6 text-brand-400" />
            Sales Pipeline
          </h1>
          <p className="text-white/40 mt-1">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} in the pipeline
          </p>
        </div>
        <Link
          href="/admin/leads/dashboard"
          className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-white/70 text-sm flex items-center gap-2"
        >
          <BarChart2 className="w-4 h-4" /> Pipeline dashboard
        </Link>
      </div>

      <LeadsBoard leads={serializable} admins={admins} />
    </div>
  )
}
