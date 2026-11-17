'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2 } from 'lucide-react'

/**
 * "Use points here": the member picks an amount and gets a 6-digit code to
 * show the partner's staff. The code is bound to this partner and amount,
 * works once, and expires after 10 minutes.
 */
export function PartnerCodeButton({ partnerId, partnerName, balance }: { partnerId: string; partnerName: string; balance: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={balance < 100}
        className="vip-focus inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" /> Use points here
      </button>
      {open && <CodeDialog partnerId={partnerId} partnerName={partnerName} balance={balance} onClose={() => setOpen(false)} />}
    </>
  )
}

function CodeDialog({ partnerId, partnerName, balance, onClose }: { partnerId: string; partnerName: string; balance: number; onClose: () => void }) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)
  const [dollars, setDollars] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<{ code: string; points: number; expiresAt: string } | null>(null)
  const [left, setLeft] = useState(0)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  useEffect(() => {
    if (!code) return
    const tick = () => setLeft(Math.max(0, Math.round((new Date(code.expiresAt).getTime() - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [code])

  const points = Math.round((Number.parseFloat(dollars) || 0) * 100)
  const maxDollars = Math.floor(balance) / 100

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/vip/rewards/partner-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerId, points }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Could not create a code.')
      return
    }
    setCode({ code: data.code, points: data.points, expiresAt: data.expiresAt })
  }

  return (
    <dialog
      ref={ref}
      onClose={() => {
        onClose()
        router.refresh()
      }}
      aria-labelledby="code-title"
      style={{ background: "#0f1729" }}
      className="vip-surface-strong m-auto w-[min(94vw,420px)] p-0 text-white backdrop:bg-black/65"
    >
      {code ? (
        <div className="p-6 text-center">
          <h2 id="code-title" className="text-lg font-semibold">Show this code at {partnerName}</h2>
          <p className="mt-1 text-sm text-white/65">
            Approves {code.points.toLocaleString('en-US')} points (${(code.points / 100).toFixed(2)}). Staff enter it with your member number.
          </p>
          <p className="mt-5 font-mono text-5xl font-extrabold tracking-[0.25em]" aria-live="polite" data-testid="partner-code">
            {left > 0 ? `${code.code.slice(0, 3)} ${code.code.slice(3)}` : '— — —'}
          </p>
          <p className="mt-3 text-sm text-white/60" role="status">
            {left > 0 ? `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'This code has expired. Create a new one.'}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {left === 0 && (
              <button type="button" onClick={() => setCode(null)} className="vip-focus rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold">
                New code
              </button>
            )}
            <button type="button" onClick={() => ref.current?.close()} className="vip-focus rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]">
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={create} className="p-5">
          <h2 id="code-title" className="text-lg font-semibold">Use points at {partnerName}</h2>
          <p className="mt-1 text-sm text-white/65">
            You have {balance.toLocaleString('en-US')} points (${(balance / 100).toFixed(2)}). Choose how much to spend — only this amount can be taken, and only at
            {' '}{partnerName}.
          </p>
          <label className="mt-4 block text-sm font-medium text-white/80">
            Amount in dollars
            <span className="relative mt-1.5 block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/55">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={maxDollars}
                step={0.01}
                required
                value={dollars}
                onChange={(e) => setDollars(e.target.value)}
                className="vip-focus h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] pl-7 pr-3 text-[15px] text-white"
              />
            </span>
          </label>
          <p className="mt-1.5 text-xs text-white/55">{points > 0 ? `${points.toLocaleString('en-US')} points` : 'Minimum $1 (100 points).'}</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="vip-focus rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || points < 100 || points > balance}
              className="vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Get my code
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
