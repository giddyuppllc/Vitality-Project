'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Plus, Pencil, Trash2, Star, X } from 'lucide-react'

interface Address {
  id: string
  name: string
  line1: string
  line2: string | null
  city: string
  state: string
  zip: string
  country: string
  phone: string | null
  isDefault: boolean
}

const emptyForm = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  phone: '',
  isDefault: false,
}

export default function AddressesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchAddresses = useCallback(async () => {
    const res = await fetch('/api/account/addresses')
    if (res.ok) {
      const data = await res.json()
      setAddresses(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchAddresses()
    }
  }, [status, router, fetchAddresses])

  const openNewForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
    setError('')
  }

  const openEditForm = (address: Address) => {
    setEditingId(address.id)
    setForm({
      name: address.name,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone ?? '',
      isDefault: address.isDefault,
    })
    setFormOpen(true)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = {
        ...form,
        line2: form.line2 || undefined,
        phone: form.phone || undefined,
      }

      const url = editingId
        ? `/api/account/addresses/${editingId}`
        : '/api/account/addresses'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setFormOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await fetchAddresses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return

    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      await fetchAddresses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete address')
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      await fetchAddresses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default address')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-white/40">Loading addresses...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Addresses</h1>
        <Button onClick={openNewForm} size="sm">
          <Plus className="w-4 h-4" /> Add Address
        </Button>
      </div>

      {error && (
        <div className="glass rounded-2xl p-4 mb-6 border border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Address form */}
      {formOpen && (
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              {editingId ? 'Edit Address' : 'New Address'}
            </h2>
            <button
              onClick={() => {
                setFormOpen(false)
                setEditingId(null)
              }}
              className="text-white/40 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="John Doe"
            />
            <Input
              label="Address Line 1"
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
              required
              placeholder="123 Main St"
            />
            <Input
              label="Address Line 2"
              value={form.line2}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
              placeholder="Apt, suite, unit (optional)"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
                placeholder="City"
              />
              <Input
                label="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                required
                placeholder="State"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="ZIP Code"
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                required
                placeholder="12345"
              />
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(optional)"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="rounded border-white/20 bg-dark-700 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-white/70">Set as default address</span>
            </label>
            <Button type="submit" loading={saving} className="w-full">
              {editingId ? 'Update Address' : 'Save Address'}
            </Button>
          </form>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No addresses saved</h2>
          <p className="text-white/40 mb-6">
            Add a shipping address to speed up checkout.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div key={addr.id} className="glass rounded-2xl p-5 relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{addr.name}</h3>
                  {addr.isDefault && <Badge variant="info">Default</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="p-1.5 rounded-lg text-white/40 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      title="Set as default"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditForm(addr)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-white/60 space-y-0.5">
                <p>{addr.line1}</p>
                {addr.line2 && <p>{addr.line2}</p>}
                <p>
                  {addr.city}, {addr.state} {addr.zip}
                </p>
                <p>{addr.country}</p>
                {addr.phone && <p className="text-white/40">{addr.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
