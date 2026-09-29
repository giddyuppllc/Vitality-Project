'use client'

import { useState } from 'react'
import { DollarSign, Check } from 'lucide-react'

interface Props {
  approvedBalanceCents: number
}

export function RequestPayoutButton({ approvedBalanceCents }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (approvedBalanceCents <= 0) {
    return (
      <p className="text-xs text-white/30">
        No approved balance yet — commissions become payable after admin approves them.
      </p>
    )
  }

  const handleRequest = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/affiliate/request-payout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-emerald-400">
        <Check className="w-4 h-4" /> Payout requested — admin will follow up
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleRequest}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        <DollarSign className="w-4 h-4" />
        {loading
          ? 'Requesting…'
          : `Request payout — $${(approvedBalanceCents / 100).toFixed(2)}`}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}
