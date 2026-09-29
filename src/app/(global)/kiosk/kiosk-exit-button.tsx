'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, X, Eye, EyeOff } from 'lucide-react'

interface Props {
  /** Plaintext PIN for this org. Null = no protection (just exits). */
  pin: string | null
}

/**
 * "Exit kiosk" button — unobtrusive in the corner. Tap it → PIN modal
 * (when org has a PIN set). Correct PIN navigates to /admin so staff
 * can manage; the customer-facing iPad is now unlocked for staff use.
 *
 * If the org didn't set a PIN, tapping Exit just navigates immediately —
 * we don't want to block legit staff from leaving kiosk mode.
 */
export function KioskExitButton({ pin }: Props) {
  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const router = useRouter()

  const exit = () => router.push('/admin')

  const handleClick = () => {
    if (!pin) {
      exit()
      return
    }
    setOpen(true)
    setEntered('')
    setError(null)
  }

  const submit = () => {
    if (entered === pin) {
      exit()
    } else {
      setError('Incorrect PIN')
      setEntered('')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="text-white/30 hover:text-white/70 transition-colors p-1.5"
        aria-label="Exit kiosk mode"
        title="Exit kiosk mode"
      >
        <LogOut className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-dark-800 border border-white/10 rounded-2xl p-7 w-full max-w-xs text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-white/40 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-2">Enter PIN to exit</h3>
            <p className="text-xs text-white/40 mb-5">Staff only.</p>

            <div className="relative mb-3">
              <input
                type={revealed ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={entered}
                onChange={(e) => {
                  setError(null)
                  setEntered(e.target.value.replace(/\D/g, ''))
                }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="w-full text-center text-2xl tracking-[0.5em] font-mono bg-dark-700 border border-white/10 rounded-xl px-4 py-3 pr-12"
                placeholder="••••"
              />
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                tabIndex={-1}
                aria-label={revealed ? 'Hide PIN' : 'Show PIN'}
                aria-pressed={revealed}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-white/40 hover:text-white/80 transition-colors"
              >
                {revealed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={entered.length < 4}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl disabled:opacity-40"
            >
              Unlock
            </button>
          </div>
        </div>
      )}
    </>
  )
}
