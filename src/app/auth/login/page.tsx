'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const params = useSearchParams()
  // Only follow internal redirects to avoid open-redirect risk. Accept either
  // ?next= (our own links) or ?callbackUrl= (what the server auth-guards send,
  // e.g. /auth/login?callbackUrl=/account/support) so users return to where
  // they were instead of getting dumped on the storefront.
  const rawNext = params.get('next') ?? params.get('callbackUrl')
  const next = rawNext && rawNext.startsWith('/') ? rawNext : null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (res?.error) {
      setError('Invalid email/username or password')
      setLoading(false)
    } else {
      // An explicit ?next= wins; otherwise ask the server where this user
      // should land. Affiliates can't be detected from the client session
      // (their role often stays CUSTOMER), so the destination is resolved
      // server-side against the Affiliate table. Fall back to '/' on error.
      let dest = next
      if (!dest) {
        try {
          const r = await fetch('/api/auth/post-login')
          if (r.ok) {
            const data = await r.json()
            if (typeof data?.path === 'string' && data.path.startsWith('/')) {
              dest = data.path
            }
          }
        } catch {
          // ignore — fall back to the storefront
        }
      }
      // Hard navigation (NOT router.push) so the navbar + every client
      // component re-reads the freshly-set session cookie. A soft SPA push
      // leaves the navbar's useSession() stale — it keeps showing "Sign In",
      // so the user clicks it and loops back to the login screen even though
      // they are actually authenticated.
      window.location.assign(dest ?? '/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-white/40 mt-1">Welcome back to The Vitality Project</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email or username"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com or your username"
              autoComplete="username"
              error={error}
            />
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300">
              Create one
            </Link>
          </p>

          {/* B2B partner path */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-brand-300/70 mb-2">For Partners</p>
              <p className="text-sm text-white/50 mb-3">
                Run a gym, clinic, or wellness practice?
              </p>
              <Link
                href="/business/apply"
                className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 font-medium"
              >
                Become a Vitality Partner →
              </Link>
              <p className="text-[11px] text-white/30 mt-2">
                Earn commission on every sale through your location
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
