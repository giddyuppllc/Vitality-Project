'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function MarkAllRead() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/vip/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true }),
        })
        setBusy(false)
        router.refresh()
      }}
      className="vip-focus rounded-xl border border-white/15 px-3.5 py-1.5 text-sm font-medium hover:bg-white/[0.06] disabled:opacity-50"
    >
      Mark all read
    </button>
  )
}
