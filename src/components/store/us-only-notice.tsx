'use client'

// US-only shipping notice + non-US lead capture.
// Renders persistently on /checkout so non-US visitors don't hit the
// brick-wall state dropdown and leave silently. Captured rows land in
// `shipping_region_interest` so we can prioritise countries by demand.

import { useState } from 'react'

const COUNTRY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'CA', label: 'Canada' },
  { code: 'MX', label: 'Mexico' },
  { code: 'UK', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'EU', label: 'Europe (other)' },
  { code: 'OTHER', label: 'Other' },
]

export function UsOnlyNotice() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !country) return
    setSubmitting(true)
    setStatus('idle')
    setErrorMsg('')
    try {
      const res = await fetch('/api/shipping-region-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), country }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setErrorMsg(j?.error || 'Could not save — please try again.')
      } else {
        setStatus('ok')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
          US shipping only
        </span>
        <p className="text-sm text-white/80">
          We currently only ship within the United States.
        </p>
        {!open && status !== 'ok' && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Outside the US? Get notified when we ship to you →
          </button>
        )}
      </div>

      {open && status !== 'ok' && (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/10 bg-dark-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand focus:outline-none"
          />
          <select
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-dark-900 px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none"
          >
            <option value="">Where to ship?</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting || !email || !country}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Notify me'}
          </button>
          {status === 'error' && (
            <p className="text-xs text-red-400 sm:col-span-3">{errorMsg}</p>
          )}
        </form>
      )}

      {status === 'ok' && (
        <p className="mt-3 text-sm text-emerald-400">
          Thanks — we'll email you when we open shipping to your region.
        </p>
      )}
    </div>
  )
}
