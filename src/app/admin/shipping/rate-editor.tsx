'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit, X } from 'lucide-react'
import { parseMoneyToCents } from '@/lib/money'

interface Props {
  mode: 'create' | 'edit'
  zoneId: string
  initial?: {
    id: string
    name: string
    price: string
    minWeight: string
    maxWeight: string
    minOrderValue: string
  }
}

export function RateEditor({ mode, zoneId, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initial?.name ?? 'Standard')
  const [price, setPrice] = useState(initial?.price ?? '')
  const [minWeight, setMinWeight] = useState(initial?.minWeight ?? '')
  const [maxWeight, setMaxWeight] = useState(initial?.maxWeight ?? '')
  const [minOrderValue, setMinOrderValue] = useState(initial?.minOrderValue ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const close = () => {
    setOpen(false)
    setError(null)
  }

  const submit = async () => {
    setError(null)
    const priceN = (parseMoneyToCents(price) ?? 0)
    if (!name.trim()) return setError('Name required')
    if (!Number.isFinite(priceN) || priceN < 0) return setError('Valid price required')
    const url =
      mode === 'create'
        ? '/api/admin/shipping/rates'
        : `/api/admin/shipping/rates/${initial!.id}`
    const method = mode === 'create' ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      name: name.trim(),
      price: priceN,
    }
    if (mode === 'create') body.zoneId = zoneId
    body.minWeight = minWeight ? parseFloat(minWeight) : null
    body.maxWeight = maxWeight ? parseFloat(maxWeight) : null
    body.minOrderValue = minOrderValue
      ? (parseMoneyToCents(minOrderValue) ?? 0)
      : null
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Save failed')
      return
    }
    close()
    startTransition(() => router.refresh())
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          mode === 'create'
            ? 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/40 text-xs text-white'
            : 'p-1.5 text-white/40 hover:text-brand-400'
        }
      >
        {mode === 'create' ? (
          <>
            <Plus className="w-3 h-3" /> Rate
          </>
        ) : (
          <Edit className="w-4 h-4" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={close}>
          <div
            className="glass rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{mode === 'create' ? 'New Rate' : 'Edit Rate'}</h3>
              <button onClick={close} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Price ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="9.99"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-400"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Min weight (lbs)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={minWeight}
                    onChange={(e) => setMinWeight(e.target.value)}
                    placeholder="empty = no min"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Max weight (lbs)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={maxWeight}
                    onChange={(e) => setMaxWeight(e.target.value)}
                    placeholder="empty = no max"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-400"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Free above ($)</span>
                <input
                  type="number"
                  step="0.01"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                  placeholder="empty = always charge"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-400"
                />
                <span className="text-xs text-white/40 mt-1 block">
                  Order subtotal above this gets free shipping for this rate
                </span>
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={close}
                  className="px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg text-sm bg-brand-500 hover:bg-brand-400 text-white disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
