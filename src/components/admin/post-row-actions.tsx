'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function PostRowActions({ id, title }: { id: string; title: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        alert(body?.error ?? `Delete failed (${res.status})`)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="text-red-400 hover:text-red-300 disabled:opacity-50 p-1.5"
      aria-label={`Delete ${title}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
