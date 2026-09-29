'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserPlus } from 'lucide-react'

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  )
}

function RegisterInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        username: form.username.trim() || undefined,
      }),
    })
    if (res.ok) {
      const target = next
        ? `/auth/login?registered=true&next=${encodeURIComponent(next)}`
        : '/auth/login?registered=true'
      router.push(target)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Registration failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-white/40 mt-1">Join The Vitality Project</p>
        </div>
        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} error={error} />
            <Input
              label="Username (optional)"
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="e.g. jane.fitness"
              hint="3-24 chars · letters, numbers, _ . -"
              autoComplete="username"
            />
            <Input label="Password" type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Input label="Confirm Password" type="password" required value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create Account
            </Button>
          </form>
          <p className="text-center text-sm text-white/40 mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brand-400 hover:text-brand-300">Sign in</Link>
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
