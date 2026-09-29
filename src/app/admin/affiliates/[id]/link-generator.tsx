'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Copy, Check } from 'lucide-react'

interface Props {
  affiliateId: string
  affiliateCode: string
  appUrl: string
}

export function LinkGenerator({ affiliateId, affiliateCode, appUrl }: Props) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !url) return
    setBusy(true)
    setError(null)
    setCreated(null)
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliateId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create link')
      setCreated(`${appUrl}/r/${affiliateCode}/${data.link.slug}`)
      setName('')
      setUrl('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setBusy(false)
    }
  }

  const copy = () => {
    if (!created) return
    navigator.clipboard.writeText(created)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-dark-700 rounded-xl p-4">
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="sm:col-span-1">
          <label className="block text-xs text-white/50 mb-1">Link name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Landing page A/B"
            className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-sm"
          />
        </div>
        <div className="sm:col-span-2 flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-white/50 mb-1">Destination URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://vitalityproject.global/products/..."
              className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !name || !url}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate
          </button>
        </div>
      </form>

      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

      {created && (
        <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
          <code className="flex-1 text-xs text-emerald-300 break-all">{created}</code>
          <button
            type="button"
            onClick={copy}
            className="p-1.5 text-emerald-400 hover:text-emerald-300"
            aria-label="Copy link"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  )
}
