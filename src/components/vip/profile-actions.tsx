'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Ban, Loader2, Mail, MoreHorizontal, ShieldCheck } from 'lucide-react'

/** Opens (or reuses) a 1:1 conversation and goes to it. */
export function MessageButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function open() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/vip/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: userId }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res?.ok) {
      setError(data?.error || 'Could not open a conversation.')
      return
    }
    router.push(`/messages/${data.id}`)
  }
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        aria-label={`Message ${name}`}
        className="vip-focus inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 px-4 text-sm font-semibold text-white/90 hover:bg-white/[0.06] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
        Message
      </button>
      {error && <span role="alert" className="mt-1 max-w-[16rem] text-xs text-red-300">{error}</span>}
    </span>
  )
}

/** "…" menu on a member's profile: block / unblock. */
export function ProfileMenu({ userId, name, blocked }: { userId: string; name: string; blocked: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  async function toggleBlock() {
    setOpen(false)
    if (!blocked && !confirm(`Block ${name}? You won’t see each other’s posts, profile or messages, and follows between you are removed.`)) return
    setBusy(true)
    const res = await fetch(`/api/vip/members/${userId}/block`, { method: blocked ? 'DELETE' : 'POST' }).catch(() => null)
    setBusy(false)
    if (res?.ok) router.refresh()
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        aria-expanded={open}
        disabled={busy}
        className="vip-focus grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/75 hover:bg-white/[0.06]"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
      </button>
      {open && (
        <div className="vip-surface-strong absolute right-0 z-20 mt-1 w-48 p-1 text-sm shadow-xl" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={toggleBlock}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06] ${blocked ? '' : 'text-red-200'}`}
          >
            {blocked ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <Ban className="h-4 w-4" aria-hidden="true" />}
            {blocked ? 'Unblock' : 'Block'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Plain Unblock button (blocked-profile view and the profile settings list). */
export function UnblockButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch(`/api/vip/members/${userId}/block`, { method: 'DELETE' }).catch(() => null)
        setBusy(false)
        router.refresh()
      }}
      aria-label={`Unblock ${name}`}
      className="vip-focus inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 px-3.5 text-sm font-medium hover:bg-white/[0.06] disabled:opacity-60"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      Unblock
    </button>
  )
}
