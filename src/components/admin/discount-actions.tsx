'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { parseMoneyToCents } from '@/lib/money'

export function DiscountActions() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [form, setForm] = useState({
    code: '', type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    value: '', minOrder: '', maxUses: '', expiresAt: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          type: form.type,
          value: form.type === 'PERCENTAGE' ? parseInt(form.value) : (parseMoneyToCents(form.value) ?? 0),
          minOrder: form.minOrder ? (parseMoneyToCents(form.minOrder) ?? 0) : undefined,
          maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
          expiresAt: form.expiresAt || undefined,
        }),
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> Create Code
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-8 w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Create Discount Code</h2>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input label="Code *" required value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER20" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-white/70 mb-1.5 block">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed Amount</option>
                  </select>
                </div>
                <Input label={form.type === 'PERCENTAGE' ? 'Value (%)' : 'Value ($)'} required type="number"
                  value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Min Order ($)" type="number" step="0.01" value={form.minOrder}
                  onChange={(e) => setForm({ ...form, minOrder: e.target.value })} placeholder="0.00" />
                <Input label="Max Uses" type="number" value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="Unlimited" />
              </div>
              <Input label="Expiry Date" type="date" value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              <Button type="submit" loading={loading} className="w-full">Create Code</Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
