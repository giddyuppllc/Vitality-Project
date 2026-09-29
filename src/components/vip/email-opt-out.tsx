'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { VIP_COPY } from '@/lib/vip/copy'

export function EmailOptOut({ u, k, t, label }: { u: string; k: string; t: string; label: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const E = VIP_COPY.emailPage
  async function confirm() {
    setState('busy')
    const res = await fetch('/api/vip/email-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ u, k, t }),
    }).catch(() => null)
    setState(res?.ok ? 'done' : 'error')
  }
  if (state === 'done') {
    return (
      <div className="mt-2 space-y-4">
        <p role="status" className="text-sm text-emerald-300">{E.done(label)}</p>
        <Link href="/profile" className="vip-focus inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">Email settings in your profile →</Link>
      </div>
    )
  }
  return (
    <div className="mt-2 space-y-4">
      <p className="text-sm text-white/70">{E.confirm(label)}</p>
      {state === 'error' && <p role="alert" className="text-sm text-red-300">{E.invalid}</p>}
      <button
        type="button"
        onClick={confirm}
        disabled={state === 'busy'}
        className="vip-focus inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {state === 'busy' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {E.button}
      </button>
    </div>
  )
}
