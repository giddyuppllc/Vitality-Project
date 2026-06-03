'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pause, Clock, Trash2 } from 'lucide-react'

type Status = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export function AffiliateStatusActions({
  id,
  status,
  commissionRate,
}: {
  id: string
  status: Status
  commissionRate: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [rate, setRate] = useState(Math.round(commissionRate * 100))

  const update = async (patch: { status?: Status; commissionRate?: number }) => {
    setBusy(true)
    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Update failed')
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!confirm('Delete this affiliate permanently? This cannot be undone.')) return
    setBusy(true)
    const res = await fetch(`/api/admin/affiliates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/admin/affiliates')
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Delete failed')
      setBusy(false)
    }
  }

  const statusBadge =
    status === 'ACTIVE'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : status === 'PENDING'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-red-500/15 text-red-300 border-red-500/30'

  const StatusIcon = status === 'ACTIVE' ? Check : status === 'PENDING' ? Clock : Pause

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge}`}>
        <StatusIcon className="w-3 h-3" />
        {status}
      </span>

      {status !== 'ACTIVE' && (
        <button
          onClick={() => update({ status: 'ACTIVE' })}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          Approve & notify
        </button>
      )}
      {status !== 'SUSPENDED' && (
        <button
          onClick={() => update({ status: 'SUSPENDED' })}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          Suspend
        </button>
      )}
      {status === 'SUSPENDED' && (
        <button
          onClick={() => update({ status: 'PENDING' })}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          Re-queue
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <label className="text-xs text-white/50">Commission</label>
        <input
          type="number"
          min={0}
          max={100}
          value={rate}
          onChange={(e) => setRate(parseInt(e.target.value || '0', 10))}
          className="w-16 px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 text-sm text-white text-right tabular-nums focus:outline-none focus:border-brand-400"
        />
        <span className="text-xs text-white/50">%</span>
        {Math.round(commissionRate * 100) !== rate && (
          <button
            onClick={() => update({ commissionRate: rate / 100 })}
            disabled={busy || rate < 0 || rate > 100}
            className="px-2.5 py-1 rounded-md bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        )}
        <button
          onClick={remove}
          disabled={busy}
          className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold disabled:opacity-50 transition-colors"
          title="Delete affiliate"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  )
}
