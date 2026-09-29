export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { MapPin, Tablet, ShoppingBag } from 'lucide-react'
import Link from 'next/link'

export default async function BusinessLocationsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!membership) redirect('/business/apply')

  const locations = await prisma.location.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      _count: {
        select: {
          devices: true,
          orders: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-white/40 mt-1">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/business/locations/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25 transition-all"
        >
          <MapPin className="w-4 h-4" />
          Add Location
        </Link>
      </div>

      {locations.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <MapPin className="w-10 h-10 text-white/20 mx-auto mb-4" />
          <h3 className="font-medium text-white/70 mb-2">No locations yet</h3>
          <p className="text-sm text-white/40 mb-6">Add your first location to start placing kiosks.</p>
          <Link
            href="/business/locations/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-all"
          >
            Add First Location
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {locations.map((loc) => (
            <div key={loc.id} className="glass rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{loc.name}</h3>
                  <p className="text-sm text-white/40 mt-1">
                    {[loc.city, loc.state].filter(Boolean).join(', ') || 'No address'}
                  </p>
                </div>
                <Badge variant="info">{Math.round(loc.commissionRate * 100)}%</Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <Tablet className="w-3.5 h-3.5" />
                  {loc._count.devices} device{loc._count.devices !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {loc._count.orders} order{loc._count.orders !== 1 ? 's' : ''}
                </span>
              </div>

              {loc.phone && (
                <p className="text-xs text-white/30 mt-3">{loc.phone}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
