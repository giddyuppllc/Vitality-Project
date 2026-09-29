'use client'

import { useEffect, useRef, useState } from 'react'

export function ReportDialog({
  target,
  onClose,
}: {
  target: { postId: string } | { commentId: string }
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('busy')
    const res = await fetch('/api/vip/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...target, reason }),
    })
    if (res.ok) setState('done')
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Could not send the report.')
      setState('error')
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="report-title"
      className="vip-surface-strong m-auto w-[min(92vw,420px)] p-0 text-white backdrop:bg-black/60"
    >
      <form onSubmit={submit} className="p-5">
        <h2 id="report-title" className="text-lg font-semibold">Report to the team</h2>
        {state === 'done' ? (
          <>
            <p className="mt-2 text-sm text-white/70">Thanks — the team will review it.</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => ref.current?.close()} className="vip-focus rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold">
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="mt-3 block text-sm text-white/75">
              What is wrong with it?
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={3}
                maxLength={1000}
                rows={4}
                className="vip-focus mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] p-3 text-sm"
              />
            </label>
            {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => ref.current?.close()} className="vip-focus rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={state === 'busy' || reason.trim().length < 3}
                className="vip-focus rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Send report
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  )
}
