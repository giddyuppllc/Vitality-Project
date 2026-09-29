'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Power, Trash2 } from 'lucide-react'

export function ToggleZoneActiveButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const toggle = async () => {
    const res = await fetch(`/api/admin/shipping/zones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    if (res.ok) startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={active ? 'Deactivate' : 'Activate'}
      className={`p-1.5 rounded-lg transition-colors ${
        active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/30 hover:bg-white/5'
      } disabled:opacity-50`}
    >
      <Power className="w-4 h-4" />
    </button>
  )
}

export function DeleteZoneButton({
  id,
  name,
  rateCount,
}: {
  id: string
  name: string
  rateCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handle = async () => {
    const confirmMsg =
      rateCount > 0
        ? `Delete "${name}" and its ${rateCount} rate${rateCount === 1 ? '' : 's'}? Active orders are unaffected; only future checkouts.`
        : `Delete "${name}"?`
    if (!confirm(confirmMsg)) return
    const res = await fetch(`/api/admin/shipping/zones/${id}`, { method: 'DELETE' })
    if (res.ok) startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title="Delete zone"
      className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

export function DeleteRateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handle = async () => {
    if (!confirm(`Delete rate "${name}"?`)) return
    const res = await fetch(`/api/admin/shipping/rates/${id}`, { method: 'DELETE' })
    if (res.ok) startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title="Delete rate"
      className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
