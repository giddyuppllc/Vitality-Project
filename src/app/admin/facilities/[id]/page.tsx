import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { FacilityForm } from '@/components/admin/facility-form'
import { FacilityProducts } from '@/components/admin/facility-products'
import { ArrowLeft, Package } from 'lucide-react'

export default async function AdminFacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/auth/login')

  const facility = await prisma.facility.findUnique({
    where: { id },
    include: {
      products: {
        include: { product: { select: { id: true, name: true, sku: true } } },
      },
      fulfillments: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNumber: true, email: true } },
        },
      },
    },
  })

  if (!facility) notFound()

  const assigned = facility.products.map((pf) => ({
    id: pf.id,
    productId: pf.productId,
    productName: pf.product.name,
    productSku: pf.product.sku,
    primary: pf.primary,
    cost: pf.cost,
    inventory: pf.inventory,
  }))

  const assignedIds = new Set(assigned.map((a) => a.productId))
  const available = await prisma.product
    .findMany({
      where: { status: 'ACTIVE', id: { notIn: Array.from(assignedIds) } },
      select: { id: true, name: true, sku: true, price: true },
      orderBy: { name: 'asc' },
      take: 200,
    })

  const statusVariant = (s: string) =>
    s === 'DELIVERED' ? 'success' :
    s === 'SHIPPED' ? 'info' :
    s === 'CANCELLED' || s === 'FAILED' ? 'danger' :
    s === 'PROCESSING' || s === 'ACCEPTED' ? 'info' : 'warning'

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/facilities" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{facility.name}</h1>
        <Badge variant={facility.active ? 'success' : 'default'}>
          {facility.active ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FacilityForm
            mode="edit"
            initial={{
              id: facility.id,
              name: facility.name,
              email: facility.email,
              contactName: facility.contactName,
              phone: facility.phone,
              addressLine1: facility.addressLine1,
              addressLine2: facility.addressLine2,
              city: facility.city,
              state: facility.state,
              zip: facility.zip,
              country: facility.country,
              licenseNumber: facility.licenseNumber,
              apiEndpoint: facility.apiEndpoint,
              apiKey: facility.apiKey,
              active: facility.active,
              slaHours: facility.slaHours,
              notes: facility.notes,
            }}
          />
        </div>

        <div className="space-y-6">
          <FacilityProducts
            facilityId={facility.id}
            assigned={assigned}
            available={available}
          />

          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-400" />
              Recent Fulfillments
            </h2>
            {facility.fulfillments.length === 0 && (
              <p className="text-sm text-white/40">No fulfillments yet.</p>
            )}
            {facility.fulfillments.map((f) => (
              <Link
                key={f.id}
                href={`/admin/fulfillments/${f.id}`}
                className="flex items-center justify-between p-3 border border-white/5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono font-medium">
                    {f.order.orderNumber}
                  </p>
                  <p className="text-xs text-white/40 truncate">
                    {f.order.email} · {formatDate(f.createdAt)}
                  </p>
                </div>
                <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
