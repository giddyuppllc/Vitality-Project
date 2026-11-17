'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function CancelRedemptionButton({ id, points }: { id: string; points: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function cancel() {
    if (!confirm(`Cancel this request? ${points.toLocaleString('en-US')} points go back to your balance.`)) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/vip/rewards/redemptions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Could not cancel.')
      return
    }
    router.refresh()
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="vip-focus inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/[0.06] disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Cancel request
      </button>
      {error && <span role="alert" className="text-xs text-red-300">{error}</span>}
    </span>
  )
}
