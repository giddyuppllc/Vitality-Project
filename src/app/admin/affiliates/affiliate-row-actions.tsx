'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Trash2 } from 'lucide-react'

type Status = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

/**
 * Inline Approve / Reject / Suspend / Delete actions for an affiliate row on the
 * admin list page. Uses the same PATCH/DELETE endpoints as the detail page so the
 * approval gate is enforced server-side (affiliate only goes ACTIVE on approval).
 */
export function AffiliateRowActions({
  id,
  status,
}: {
  id: string
  status: Status
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const patchStatus = async (next: Status) => {
    setBusy(true)
    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) router.refresh()
    else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Update failed')
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!confirm('Delete this affiliate permanently? This cannot be undone.')) return
    setBusy(true)
    const res = await fetch(`/api/admin/affiliates/${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
    else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Delete failed')
    }
    setBusy(false)
  }

  return (
    <div className="inline-flex items-center gap-1">
      {status === 'PENDING' && (
        <button
          type="button"
          onClick={() => patchStatus('ACTIVE')}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          title="Approve"
        >
          <CheckCircle className="w-3.5 h-3.5" /> Approve
        </button>
      )}
      {status === 'ACTIVE' && (
        <button
          type="button"
          onClick={() => patchStatus('SUSPENDED')}
          disabled={busy}
          className="p-1.5 text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
          title="Suspend"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
      {status === 'SUSPENDED' && (
        <button
          type="button"
          onClick={() => patchStatus('ACTIVE')}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          title="Reactivate"
        >
          <CheckCircle className="w-3.5 h-3.5" /> Reactivate
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="p-1.5 text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
        title="Delete affiliate"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
