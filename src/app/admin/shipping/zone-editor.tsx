'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit, X } from 'lucide-react'

interface Props {
  mode: 'create' | 'edit'
  initial?: { id: string; name: string; countries: string }
}

export function ZoneEditor({ mode, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [countries, setCountries] = useState(initial?.countries ?? 'US')
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const close = () => {
    setOpen(false)
    setError(null)
  }

  const submit = async () => {
    setError(null)
    const countryList = countries
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)
    if (!name.trim()) {
      setError('Name required')
      return
    }
    if (countryList.length === 0) {
      setError('At least one country required')
      return
    }
    const url =
      mode === 'create'
        ? '/api/admin/shipping/zones'
        : `/api/admin/shipping/zones/${initial!.id}`
    const method = mode === 'create' ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      name: name.trim(),
      countries: countryList,
    }
    if (mode === 'create') body.active = active
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
            ? 'inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium'
            : 'p-1.5 text-white/40 hover:text-brand-400'
        }
      >
        {mode === 'create' ? (
          <>
            <Plus className="w-4 h-4" /> New zone
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
              <h3 className="font-semibold">{mode === 'create' ? 'New Shipping Zone' : 'Edit Zone'}</h3>
              <button onClick={close} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Domestic US"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-400"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Countries</span>
                <input
                  value={countries}
                  onChange={(e) => setCountries(e.target.value)}
                  placeholder="US, CA, MX"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-400 uppercase"
                />
                <span className="text-xs text-white/40 mt-1 block">
                  Comma-separated ISO 2-letter codes
                </span>
              </label>
              {mode === 'create' && (
                <label className="inline-flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  Active
                </label>
              )}
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
