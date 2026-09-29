'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CheckCheck } from 'lucide-react'

export function MarkAllReadButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  const handle = async () => {
    setDone(false)
    const res = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    if (res.ok) {
      setDone(true)
      startTransition(() => router.refresh())
    }
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/40 text-sm text-white transition-colors disabled:opacity-50"
    >
      <CheckCheck className="w-4 h-4" />
      {pending ? 'Marking…' : done ? 'All marked read' : 'Mark all read'}
    </button>
  )
}

export function MarkOneReadLink({ id, read }: { id: string; read: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (read) return null

  const handle = async () => {
    const res = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
    >
      Mark read
    </button>
  )
}
