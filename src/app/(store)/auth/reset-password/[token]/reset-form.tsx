'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,23}$/

export function ResetPasswordForm({ token, isInvite = false }: { token: string; isInvite?: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // Only collected on first activation; existing users on a reset link
  // already have their identity established via email.
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    const trimmedUsername = username.trim()
    if (isInvite && trimmedUsername && !USERNAME_REGEX.test(trimmedUsername)) {
      setError('Username must be 3-24 chars (letters, numbers, _ . -); start with a letter or digit.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/account/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password,
        // Only send username on the activation path. Backend treats it
        // as optional — existing accounts can still complete a normal
        // password reset without setting one.
        ...(isInvite && trimmedUsername ? { username: trimmedUsername } : {}),
      }),
    })

    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push('/auth/login'), 1500)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Reset failed. Request a new link.')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <p className="text-white">{isInvite ? 'Account activated.' : 'Password updated.'}</p>
        <p className="text-sm text-white/40">Redirecting to sign in…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isInvite && (
        <Input
          label="Username (optional)"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. jane.fitness"
          hint="3-24 chars · letters, numbers, _ . - · pick one to log in with instead of email"
          autoComplete="username"
        />
      )}
      <Input
        label={isInvite ? 'Choose a password' : 'New password'}
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="new-password"
      />
      <Input
        label={isInvite ? 'Confirm password' : 'Confirm new password'}
        type="password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="••••••••"
        autoComplete="new-password"
        error={error}
      />
      <Button type="submit" loading={loading} className="w-full" size="lg">
        {isInvite ? 'Activate account' : 'Update password'}
      </Button>
      {!isInvite && (
        <p className="text-center text-sm text-white/40">
          <Link
            href="/auth/reset-password"
            className="text-brand-400 hover:text-brand-300"
          >
            Request a new link
          </Link>
        </p>
      )}
    </form>
  )
}
