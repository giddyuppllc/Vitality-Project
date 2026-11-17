'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminInput } from './admin-vip-ui'

/** Community points amounts (vip.points.*), saved through /api/admin/vip/settings. */
export function SocialPointsForm({ initial }: { initial: { firstPost: number; postDay: number } }) {
  const router = useRouter()
  const [firstPost, setFirstPost] = useState(String(initial.firstPost))
  const [postDay, setPostDay] = useState(String(initial.postDay))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <form
      className="glass space-y-4 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setMsg(null)
        const res = await fetch('/api/admin/vip/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'vip.points.firstPost': Number.parseInt(firstPost || '0', 10),
            'vip.points.postDay': Number.parseInt(postDay || '0', 10),
          }),
        })
        const data = await res.json().catch(() => ({}))
        setBusy(false)
        setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: data.error || 'Failed' })
        if (res.ok) router.refresh()
      }}
    >
      <h2 className="font-semibold">Community points</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-white/60">
          First post (once per member, 0 = off)
          <input className={`${adminInput} mt-1`} inputMode="numeric" value={firstPost} onChange={(e) => setFirstPost(e.target.value)} />
        </label>
        <label className="block text-sm text-white/60">
          Posting on a day (once per member per day, 0 = off)
          <input className={`${adminInput} mt-1`} inputMode="numeric" value={postDay} onChange={(e) => setPostDay(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-white/40">
        Points go to the shared ledger (100 points = $1) exactly once per member, and once per member per day in the clubhouse time zone.
      </p>
      {msg && <p role="status" className={msg.ok ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>{msg.text}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Save community points
      </button>
    </form>
  )
}
