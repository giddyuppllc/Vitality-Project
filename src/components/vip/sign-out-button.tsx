'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/vip/auth/logout', { method: 'POST' }).catch(() => {})
        router.replace('/')
        router.refresh()
      }}
      className="vip-focus rounded-xl px-3.5 py-2 font-medium text-white/65 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
    >
      Sign out
    </button>
  )
}
