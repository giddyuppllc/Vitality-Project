export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Building2, Eye, Plus } from 'lucide-react'

export default async function AdminFacilitiesPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const facilities = await prisma.facility.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { products: true, fulfillments: true } },
    },
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-400" />
            Fulfillment Facilities
          </h1>
          <p className="text-white/40 mt-1">
            {facilities.length} total — licensed Florida shipping partners
          </p>
        </div>
        <Link
          href="/admin/facilities/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Facility
        </Link>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Name</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Location</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">License</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Products</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">Fulfillments</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">SLA</th>
              <th className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {facilities.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-white/30 text-sm">
                  No facilities yet. <Link href="/admin/facilities/new" className="text-brand-400 hover:underline">Add one</Link> to start routing orders.
                </td>
              </tr>
            )}
            {facilities.map((f) => (
              <tr key={f.id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4">
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-white/30">{f.email}</p>
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {f.city}, {f.state}
                </td>
                <td className="px-5 py-4 text-xs font-mono text-white/50">
                  {f.licenseNumber ?? '—'}
                </td>
                <td className="px-5 py-4">
                  <Badge variant={f.active ? 'success' : 'default'}>
                    {f.active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-sm">{f._count.products}</td>
                <td className="px-5 py-4 text-sm">{f._count.fulfillments}</td>
                <td className="px-5 py-4 text-sm text-white/50">{f.slaHours}h</td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/facilities/${f.id}`}
                    className="p-1.5 text-white/30 hover:text-white transition-colors inline-flex"
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
