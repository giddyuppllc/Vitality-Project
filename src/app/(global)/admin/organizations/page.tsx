export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Building2, Eye } from 'lucide-react'
import { InviteGymButton } from './invite-gym-button'

export default async function AdminOrganizationsPage() {
  const organizations = await prisma.organization.findMany({
    include: {
      _count: { select: { locations: true } },
      members: {
        where: { role: 'OWNER' },
        include: { user: { select: { email: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Get commission totals per org
  const orgIds = organizations.map((o) => o.id)
  const commissionTotals = await prisma.orderCommission.groupBy({
    by: ['locationId'],
    where: {
      location: { organizationId: { in: orgIds } },
    },
    _sum: { amount: true },
  })

  // Map location to org for aggregation
  const locationToOrg = new Map<string, string>()
  const allLocations = await prisma.location.findMany({
    where: { organizationId: { in: orgIds } },
    select: { id: true, organizationId: true },
  })
  allLocations.forEach((l) => locationToOrg.set(l.id, l.organizationId))

  const orgCommissions = new Map<string, number>()
  commissionTotals.forEach((ct) => {
    const orgId = locationToOrg.get(ct.locationId)
    if (orgId) {
      orgCommissions.set(orgId, (orgCommissions.get(orgId) ?? 0) + (ct._sum.amount ?? 0))
    }
  })

  const statusVariant = (s: string) =>
    s === 'ACTIVE' ? 'success' : 'warning'

  const statusLabel = (s: string) =>
    s === 'SUSPENDED' ? 'PENDING' : s

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-400" />
            Organizations
          </h1>
          <p className="text-white/40 mt-1">{organizations.length} total</p>
        </div>
        <InviteGymButton />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Name</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Type</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Locations</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Commissions</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Owner</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {organizations.map((org) => (
              <tr key={org.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4">
                  <p className="text-sm font-medium">{org.name}</p>
                  <p className="text-xs text-white/30">{org.slug}</p>
                </td>
                <td className="px-5 py-4 text-sm text-white/60">{org.type.replace('_', ' ')}</td>
                <td className="px-5 py-4">
                  <Badge variant={statusVariant(org.status)}>{statusLabel(org.status)}</Badge>
                </td>
                <td className="px-5 py-4 text-sm">{org._count.locations}</td>
                <td className="px-5 py-4 text-sm font-bold text-emerald-400">
                  {formatPrice(orgCommissions.get(org.id) ?? 0)}
                </td>
                <td className="px-5 py-4 text-sm text-white/50">
                  {org.members[0]?.user.email || 'N/A'}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="p-1.5 text-white/30 hover:text-white transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
