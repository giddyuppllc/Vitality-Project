'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

export function CancelMembershipButton({ membershipId }: { membershipId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cancel = async () => {
    setError(null)
    const res = await fetch('/api/membership/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Cancel failed')
      return
    }
    setOpen(false)
    startTransition(() => router.refresh())
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 border border-red-500/30"
      >
        Cancel Membership
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Cancel Membership?</h3>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-white/60 leading-relaxed mb-2">
              You'll keep your member benefits until the end of the current
              billing period. After that:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed list-disc pl-5 mb-4 space-y-1">
              <li>No more invoices will be sent.</li>
              <li>Permanent discount and free shipping turn off.</li>
              <li>Any unused free-peptide credits expire.</li>
              <li>Rejoin any time with no penalty.</li>
            </ul>
            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white"
              >
                Keep Membership
              </button>
              <button
                onClick={cancel}
                disabled={pending}
                className="px-3 py-2 rounded-lg text-sm bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
              >
                {pending ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
