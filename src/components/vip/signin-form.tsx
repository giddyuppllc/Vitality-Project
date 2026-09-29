'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function SignInForm() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/vip/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Sign in failed.')
        setBusy(false)
        return
      }
      router.replace('/feed')
      router.refresh()
    } catch {
      setError('Network error — try again.')
      setBusy(false)
    }
  }

  const field =
    'vip-focus mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-[15px] text-white placeholder:text-white/35'

  return (
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      <label className="block text-sm font-medium text-white/80">
        Email or username
        <input
          className={field}
          type="text"
          autoComplete="username"
          inputMode="email"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </label>
      <label className="block text-sm font-medium text-white/80">
        Password
        <input
          className={field}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !identifier || !password}
        className="vip-focus flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Sign in
      </button>
    </form>
  )
}
