'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Copy, Gift, Loader2, Receipt } from 'lucide-react'

interface Invoice {
  orderNumber: string
  total: number
  zelle: { primary: string; altHandle?: string; displayName?: string }
}

const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
const pts = (n: number) => n.toLocaleString('en-US')

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* clipboard unavailable — the value is on screen */
        }
      }}
      className="vip-focus grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/[0.08] hover:text-white"
      aria-label={done ? `${label} copied` : `Copy ${label}`}
    >
      {done ? <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}

function InvoiceBox({ invoice, globalOrdersUrl }: { invoice: Invoice; globalOrdersUrl: string }) {
  const rows: Array<[string, string, boolean]> = [
    ['Send by Zelle to', invoice.zelle.primary, true],
    ...(invoice.zelle.displayName ? [['Account name', invoice.zelle.displayName, false] as [string, string, boolean]] : []),
    ['Amount', usd(invoice.total), true],
    ['Memo (invoice number)', invoice.orderNumber, true],
  ]
  return (
    <div className="rounded-2xl border border-[#d4b26a]/40 bg-[#d4b26a]/[0.06] p-4" data-testid="training-invoice" role="status">
      <p className="flex items-center gap-2 font-semibold">
        <Receipt className="vip-gold h-4 w-4" aria-hidden="true" /> Invoice {invoice.orderNumber} is waiting for payment
      </p>
      <p className="mt-1 text-sm text-white/70">
        Send one Zelle payment with the invoice number as the memo. The training opens here as soon as it is confirmed — usually the same day. The same details are in your inbox.
      </p>
      <dl className="mt-3 divide-y divide-white/[0.08] rounded-xl border border-white/10 bg-black/20">
        {rows.map(([k, v, copy]) => (
          <div key={k} className="flex items-center gap-3 px-3 py-2">
            <dt className="w-36 shrink-0 text-xs text-white/60">{k}</dt>
            <dd className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{v}</dd>
            {copy && <CopyButton value={v} label={k.toLowerCase()} />}
          </div>
        ))}
      </dl>
      {invoice.zelle.altHandle && <p className="mt-2 text-xs text-white/60">Or send to {invoice.zelle.altHandle}.</p>}
      <a href={globalOrdersUrl} className="vip-focus mt-3 inline-block rounded text-sm font-medium text-brand-300 hover:text-brand-200">
        See it in your orders at vitalityproject.global →
      </a>
    </div>
  )
}

/**
 * Unlock a training: with points (instant) or with a Zelle invoice
 * (opens when the payment is confirmed). Both buttons ask before acting.
 */
export function TrainingPurchase({
  courseId,
  courseTitle,
  priceCents,
  pointsPrice,
  balance,
  openInvoice,
  globalOrdersUrl,
}: {
  courseId: string
  courseTitle: string
  priceCents: number | null
  pointsPrice: number | null
  balance: number
  openInvoice: Invoice | null
  globalOrdersUrl: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'points' | 'zelle' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'points' | 'zelle' | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(openInvoice)
  const enough = pointsPrice !== null && balance >= pointsPrice

  async function redeem() {
    setBusy('points')
    setError(null)
    const res = await fetch(`/api/vip/trainings/${courseId}/redeem`, { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    setConfirming(null)
    if (!res.ok) return setError(d.error || 'That didn’t work — nothing was spent.')
    router.refresh()
  }

  async function requestInvoice() {
    setBusy('zelle')
    setError(null)
    const res = await fetch(`/api/vip/trainings/${courseId}/invoice`, { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    setConfirming(null)
    if (!res.ok) return setError(d.error || 'That didn’t work. Please try again.')
    if (d.already) return router.refresh()
    setInvoice(d.invoice)
  }

  return (
    <section className="vip-surface-strong vip-premium mt-4 p-5" aria-labelledby="unlock-h" data-testid="training-purchase">
      <h2 id="unlock-h" className="flex items-center gap-2 font-semibold">
        <Gift className="vip-gold h-5 w-5" aria-hidden="true" /> Unlock this training
      </h2>
      <p className="mt-1 text-sm text-white/70">Yours to keep: every lesson, module check and the certificate, whatever your level.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pointsPrice !== null && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">With points</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{pts(pointsPrice)}</p>
            <p className="text-xs text-white/60">You have {pts(balance)} points</p>
            {confirming === 'points' ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-white/80">
                  Spend {pts(pointsPrice)} points on {courseTitle}?
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={redeem} disabled={busy !== null} className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                    {busy === 'points' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Yes, unlock
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="vip-focus min-h-[44px] rounded-xl px-3 text-sm text-white/70 hover:bg-white/[0.06]">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!enough || busy !== null}
                onClick={() => setConfirming('points')}
                className="vip-focus mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/60"
              >
                {enough ? 'Unlock with points' : `${pts(pointsPrice - balance)} more points needed`}
              </button>
            )}
          </div>
        )}
        {priceCents !== null && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">With Zelle</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{usd(priceCents)}</p>
            <p className="text-xs text-white/60">One payment, opens once confirmed</p>
            {!invoice &&
              (confirming === 'zelle' ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-white/80">We’ll create a {usd(priceCents)} Zelle invoice and email you the details.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={requestInvoice} disabled={busy !== null} className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#0b1322] hover:bg-white/90 disabled:opacity-60">
                      {busy === 'zelle' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Create invoice
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="vip-focus min-h-[44px] rounded-xl px-3 text-sm text-white/70 hover:bg-white/[0.06]">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setConfirming('zelle')}
                  className="vip-focus mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold hover:bg-white/[0.06]"
                >
                  Pay with Zelle
                </button>
              ))}
          </div>
        )}
      </div>
      {invoice && (
        <div className="mt-4">
          <InvoiceBox invoice={invoice} globalOrdersUrl={globalOrdersUrl} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </section>
  )
}
