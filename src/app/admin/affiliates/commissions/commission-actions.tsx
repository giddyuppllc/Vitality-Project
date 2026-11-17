'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { adminFetch } from '@/lib/admin-fetch'

/** Approve / cancel one commission (see /api/admin/affiliates/commissions/[id]). */
export function CommissionActions({
  id,
  status,
  orderPaid,
}: {
  id: string
  status: string
  orderPaid: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (status !== 'PENDING' && status !== 'APPROVED') return null

  const run = async (action: 'approve' | 'cancel') => {
    if (action === 'cancel' && !confirm('Cancel this commission? It will not be paid out.')) return
    setBusy(true)
    setError('')
    const r = await adminFetch(`/api/admin/affiliates/commissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusy(false)
    if (!r.ok) return setError(r.error)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {busy && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
      {!busy && status === 'PENDING' && (
        <button
          type="button"
          onClick={() => run('approve')}
          disabled={!orderPaid}
          title={orderPaid ? 'Approve for payout' : 'The order is not paid'}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" /> Approve
        </button>
      )}
      {!busy && (
        <button
          type="button"
          onClick={() => run('cancel')}
          title="Cancel commission"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/50 hover:text-red-400 hover:bg-red-500/10"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      )}
      {error && <span role="alert" className="text-xs text-red-400 ml-1">{error}</span>}
    </div>
  )
}
