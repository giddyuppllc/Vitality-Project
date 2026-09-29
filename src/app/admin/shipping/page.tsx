import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Truck, Plus } from 'lucide-react'
import { ZoneEditor } from './zone-editor'
import { RateEditor } from './rate-editor'
import { ToggleZoneActiveButton, DeleteZoneButton, DeleteRateButton } from './row-actions'

export const dynamic = 'force-dynamic'

export default async function AdminShippingPage() {
  const zones = await prisma.shippingZone.findMany({
    include: { rates: { orderBy: { price: 'asc' } } },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-5 h-5" /> Shipping
          </h1>
          <p className="text-white/40 mt-1">
            {zones.length} zone{zones.length === 1 ? '' : 's'} ·{' '}
            {zones.reduce((s, z) => s + z.rates.length, 0)} rate
            {zones.reduce((s, z) => s + z.rates.length, 0) === 1 ? '' : 's'}
          </p>
        </div>
        <ZoneEditor mode="create" />
      </div>

      {zones.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Truck className="w-10 h-10 mx-auto mb-3 text-white/15" />
          <p className="text-white/40 mb-2">No shipping zones configured.</p>
          <p className="text-xs text-white/30">
            Checkout currently falls back to free shipping. Add a zone + at least one rate
            to charge for shipping per region.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {zones.map((zone) => (
            <div key={zone.id} className="glass rounded-2xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{zone.name}</h2>
                  <Badge variant={zone.active ? 'success' : 'default'}>
                    {zone.active ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-xs text-white/40">
                    {zone.countries.length} countr{zone.countries.length === 1 ? 'y' : 'ies'}:{' '}
                    {zone.countries.slice(0, 6).join(', ')}
                    {zone.countries.length > 6 && '…'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleZoneActiveButton id={zone.id} active={zone.active} />
                  <ZoneEditor
                    mode="edit"
                    initial={{ id: zone.id, name: zone.name, countries: zone.countries.join(', ') }}
                  />
                  <DeleteZoneButton id={zone.id} name={zone.name} rateCount={zone.rates.length} />
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
                    Rates ({zone.rates.length})
                  </p>
                  <RateEditor mode="create" zoneId={zone.id} />
                </div>
                {zone.rates.length === 0 ? (
                  <p className="text-sm text-white/30">No rates yet — add one to start charging shipping for this zone.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-white/5">
                        <th className="pb-2 text-xs font-medium text-white/40 uppercase tracking-wider">Name</th>
                        <th className="pb-2 text-xs font-medium text-white/40 uppercase tracking-wider">Price</th>
                        <th className="pb-2 text-xs font-medium text-white/40 uppercase tracking-wider">Weight</th>
                        <th className="pb-2 text-xs font-medium text-white/40 uppercase tracking-wider">Min order (free)</th>
                        <th className="pb-2 text-right text-xs font-medium text-white/40 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {zone.rates.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 text-sm text-white">{r.name}</td>
                          <td className="py-2.5 text-sm font-medium text-emerald-400">{formatPrice(r.price)}</td>
                          <td className="py-2.5 text-sm text-white/60">
                            {r.minWeight != null || r.maxWeight != null
                              ? `${r.minWeight ?? '0'}–${r.maxWeight ?? '∞'} lbs`
                              : '—'}
                          </td>
                          <td className="py-2.5 text-sm text-white/60">
                            {r.minOrderValue ? formatPrice(r.minOrderValue) : '—'}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <RateEditor
                                mode="edit"
                                zoneId={zone.id}
                                initial={{
                                  id: r.id,
                                  name: r.name,
                                  price: (r.price / 100).toFixed(2),
                                  minWeight: r.minWeight?.toString() ?? '',
                                  maxWeight: r.maxWeight?.toString() ?? '',
                                  minOrderValue:
                                    r.minOrderValue != null
                                      ? (r.minOrderValue / 100).toFixed(2)
                                      : '',
                                }}
                              />
                              <DeleteRateButton id={r.id} name={r.name} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
