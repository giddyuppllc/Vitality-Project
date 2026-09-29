'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Loader2 } from 'lucide-react'

interface Props {
  affiliateId: string
  owedCents: number
}

const METHODS = [
  { key: 'paypal', label: 'PayPal' },
  { key: 'wire', label: 'Wire' },
  { key: 'check', label: 'Check' },
  { key: 'manual', label: 'Manual / out-of-band' },
] as const

/** Inline button → modal → POST /api/admin/affiliates/[id]/payout. */
export function MarkPaidButton({ affiliateId, owedCents }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [method, setMethod] = useState<typeof METHODS[number]['key']>('paypal')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliateId}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, reference: reference || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payout failed')
      setOpen(false)
      setReference('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payout failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Mark $${(owedCents / 100).toFixed(2)} paid`}
        className="p-1.5 text-amber-400 hover:text-amber-300 transition-colors"
      >
        <DollarSign className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1">Mark Affiliate Paid</h3>
            <p className="text-sm text-white/50 mb-5">
              Records a payout of <strong className="text-emerald-400">${(owedCents / 100).toFixed(2)}</strong> against
              all approved unpaid commissions for this affiliate.
            </p>

            <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">
              Method
            </label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className={`px-3 py-2 rounded-lg text-sm border transition ${
                    method === m.key
                      ? 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-white/10 bg-dark-700 text-white/60 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">
              Reference (optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PayPal txn id, wire reference, check #…"
              className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 mb-5"
            />

            {error && (
              <p className="text-xs text-red-400 mb-3">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 text-sm text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-lg disabled:opacity-60 inline-flex items-center gap-2"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Mark Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
