'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin-fetch'
import { Check, X, Play, Trash2 } from 'lucide-react'

interface Props {
  taskId: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}

export function TaskRowActions({ taskId, status }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const update = async (next: Props['status']) => {
    setBusy(true)
    try {
      const r = await adminFetch(`/api/admin/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!r.ok) alert(r.error)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('Delete this task?')) return
    setBusy(true)
    try {
      const r = await adminFetch(`/api/admin/tasks/${taskId}`, { method: 'DELETE' })
      if (!r.ok) alert(r.error)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const inProgress = status === 'IN_PROGRESS'
  const done = status === 'COMPLETED' || status === 'CANCELLED'

  return (
    <div className="inline-flex items-center gap-1">
      {!done && !inProgress && (
        <button
          type="button"
          onClick={() => update('IN_PROGRESS')}
          disabled={busy}
          title="Start"
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      )}
      {!done && (
        <button
          type="button"
          onClick={() => update('COMPLETED')}
          disabled={busy}
          title="Complete"
          className="w-7 h-7 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 flex items-center justify-center"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
      {!done && (
        <button
          type="button"
          onClick={() => update('CANCELLED')}
          disabled={busy}
          title="Cancel"
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        title="Delete"
        className="w-7 h-7 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 flex items-center justify-center"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
