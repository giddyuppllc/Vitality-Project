'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'
import { Plus, Trash2, Star } from 'lucide-react'
import { parseMoneyToCents } from '@/lib/money'

type AssignedProduct = {
  id: string // ProductFacility id
  productId: string
  productName: string
  productSku: string | null
  primary: boolean
  cost: number | null
  inventory: number
}

type AvailableProduct = {
  id: string
  name: string
  sku: string | null
  price: number
}

interface Props {
  facilityId: string
  assigned: AssignedProduct[]
  available: AvailableProduct[]
}

export function FacilityProducts({ facilityId, assigned, available }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState('')
  const [primary, setPrimary] = useState(true)
  const [cost, setCost] = useState('')
  const [inventory, setInventory] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assign = async () => {
    if (!selected) {
      setError('Pick a product')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/facilities/${facilityId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selected,
          primary,
          cost: cost ? (parseMoneyToCents(cost) ?? 0) : null,
          inventory: Number(inventory) || 0,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to assign')
      }
      setSelected('')
      setCost('')
      setInventory('0')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  const update = async (productId: string, patch: Partial<AssignedProduct>) => {
    setLoading(true)
    try {
      await fetch(`/api/admin/facilities/${facilityId}/products`, {
        method: 'POST', // POST is upsert
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          primary: patch.primary,
          cost: patch.cost,
          inventory: patch.inventory,
        }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const remove = async (productId: string) => {
    if (!confirm('Remove this product from the facility?')) return
    setLoading(true)
    try {
      await fetch(`/api/admin/facilities/${facilityId}/products?productId=${productId}`, {
        method: 'DELETE',
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="font-semibold">Product Assignments</h2>
        <p className="text-xs text-white/40 mt-1">
          Products this facility can fulfill. Set a primary to auto-route orders.
        </p>
      </div>

      {/* Assign new */}
      <div className="border border-white/10 rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Add Product</p>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Select a product...</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.sku ? `(${p.sku})` : ''} — {formatPrice(p.price)}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Wholesale Cost ($)" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Input label="Inventory" type="number" value={inventory} onChange={(e) => setInventory(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={primary}
            onChange={(e) => setPrimary(e.target.checked)}
            className="accent-brand-500"
          />
          <span>Set as primary facility for this product</span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button size="sm" onClick={assign} loading={loading}>
          <Plus className="w-4 h-4" />
          Assign
        </Button>
      </div>

      {/* Existing */}
      {assigned.length === 0 && (
        <p className="text-sm text-white/40">No products assigned yet.</p>
      )}
      {assigned.length > 0 && (
        <div className="space-y-2">
          {assigned.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 border border-white/5 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.productName}</p>
                <p className="text-xs text-white/40 font-mono truncate">{a.productSku ?? '—'}</p>
              </div>
              <div className="text-xs text-white/50 text-right">
                <p>Cost: {a.cost != null ? formatPrice(a.cost) : '—'}</p>
                <p>Stock: {a.inventory}</p>
              </div>
              <button
                onClick={() => update(a.productId, { primary: !a.primary, cost: a.cost ?? undefined, inventory: a.inventory })}
                disabled={loading}
                className={`p-2 rounded-lg border border-white/10 transition-colors ${a.primary ? 'text-amber-400 bg-amber-400/10' : 'text-white/30 hover:text-white/70'}`}
                title={a.primary ? 'Primary facility' : 'Set as primary'}
              >
                <Star className={`w-4 h-4 ${a.primary ? 'fill-amber-400' : ''}`} />
              </button>
              <Badge variant={a.primary ? 'info' : 'default'}>
                {a.primary ? 'PRIMARY' : 'SECONDARY'}
              </Badge>
              <button
                onClick={() => remove(a.productId)}
                disabled={loading}
                className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
