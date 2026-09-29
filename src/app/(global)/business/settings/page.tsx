'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function BusinessSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [org, setOrg] = useState({
    name: '',
    slug: '',
    type: '',
  })

  useEffect(() => {
    fetch('/api/business/settings')
      .then((res) => res.json())
      .then((data) => {
        setOrg(data)
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const form = new FormData(e.currentTarget)
    const body = {
      name: form.get('name'),
    }

    try {
      const res = await fetch('/api/business/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update settings')
      }

      setSuccess('Settings updated successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-white/40 mt-1">Update your business profile</p>
      </div>

      <div className="glass rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            name="name"
            label="Business Name"
            defaultValue={org.name}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/70">Slug</label>
            <div className="px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white/50 text-sm">
              {org.slug}
            </div>
            <p className="text-xs text-white/30">Used for your kiosk subdomain. Contact support to change.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/70">Business Type</label>
            <div className="px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white/50 text-sm">
              {org.type?.replace('_', ' ')}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <Button type="submit" loading={loading}>Save Changes</Button>
        </form>
      </div>
    </div>
  )
}
