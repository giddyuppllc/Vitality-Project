'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function NewLocationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const body = {
      name: form.get('name'),
      addressLine1: form.get('addressLine1'),
      addressLine2: form.get('addressLine2'),
      city: form.get('city'),
      state: form.get('state'),
      zip: form.get('zip'),
      phone: form.get('phone'),
    }

    try {
      const res = await fetch('/api/business/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create location')
      }

      router.push('/business/locations')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Add Location</h1>
        <p className="text-white/40 mt-1">Set up a new kiosk location for your business.</p>
      </div>

      <div className="glass rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input name="name" label="Location Name" placeholder="Downtown Office" required />

          <Input name="addressLine1" label="Address Line 1" placeholder="123 Main St" required />
          <Input name="addressLine2" label="Address Line 2 (optional)" placeholder="Suite 200" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input name="city" label="City" placeholder="New York" required />
            <Input name="state" label="State" placeholder="NY" required />
            <Input name="zip" label="ZIP Code" placeholder="10001" required />
          </div>

          <Input name="phone" label="Phone" type="tel" placeholder="(555) 123-4567" />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/70">Commission Rate</label>
            <div className="px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white/50 text-sm">
              Commission rate is set by The Vitality Project admin team.
              Default rate: 10%
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" loading={loading}>Create Location</Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
