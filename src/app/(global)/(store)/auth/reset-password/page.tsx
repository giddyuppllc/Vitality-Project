'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeyRound } from 'lucide-react'

export default function RequestPasswordResetPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/account/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null)
    setLoading(false)
    // Always show success to prevent enumeration — mirrors the API's generic response
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-white/40 mt-1">
            Enter your email — we&apos;ll send a reset link.
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <p className="text-white">
                If that email is registered, a reset link is on its way. Check
                your inbox (and spam folder).
              </p>
              <p className="text-sm text-white/40">
                The link will expire in 1 hour.
              </p>
              <Link
                href="/auth/login"
                className="inline-block text-brand-400 hover:text-brand-300"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button
                type="submit"
                loading={loading}
                className="w-full"
                size="lg"
              >
                Send reset link
              </Button>
              <p className="text-center text-sm text-white/40">
                Remembered it?{' '}
                <Link
                  href="/auth/login"
                  className="text-brand-400 hover:text-brand-300"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
