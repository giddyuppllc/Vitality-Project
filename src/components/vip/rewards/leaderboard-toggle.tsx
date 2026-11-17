'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LeaderboardToggle({ initial, label, help }: { initial: boolean; label: string; help: string }) {
  const router = useRouter()
  const [hidden, setHidden] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function change(next: boolean) {
    setBusy(true)
    setError(null)
    setHidden(next)
    const res = await fetch('/api/vip/rewards/prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hideFromLeaderboards: next }),
    })
    setBusy(false)
    if (!res.ok) {
      setHidden(!next)
      setError('Could not save. Try again.')
      return
    }
    router.refresh()
  }
  return (
    <div className="vip-surface flex items-start gap-3 p-4">
      <input
        id="lb-hide"
        type="checkbox"
        checked={hidden}
        disabled={busy}
        onChange={(e) => change(e.target.checked)}
        className="vip-focus mt-0.5 h-5 w-5 shrink-0 accent-[#1d6fd6]"
      />
      <label htmlFor="lb-hide" className="text-sm">
        <span className="font-semibold">{label}</span>
        <span className="block text-white/60">{help}</span>
        {error && <span role="alert" className="block text-red-300">{error}</span>}
      </label>
    </div>
  )
}
