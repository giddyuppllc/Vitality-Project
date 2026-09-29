'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link2, TrendingUp, DollarSign, BarChart2, CheckCircle } from 'lucide-react'
import Link from 'next/link'

const perks = [
  { icon: DollarSign, title: '10% Commission', desc: 'On every sale you refer, flat rate.' },
  { icon: BarChart2, title: 'Real-Time Analytics', desc: 'Track clicks, conversions, and earnings live.' },
  { icon: TrendingUp, title: 'Tiered Bonuses', desc: 'Earn more as your volume grows.' },
  { icon: Link2, title: 'Server-Side Tracking', desc: 'Immune to ad blockers — every click counted.' },
]

export default function AffiliatePage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [paypalEmail, setPaypalEmail] = useState('')

  const handleApply = async () => {
    if (!session) return
    setLoading(true)
    try {
      const res = await fetch('/api/affiliate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paypalEmail }),
      })
      if (res.ok) setSuccess(true)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-brand-400 mb-6">
          <Link2 className="w-4 h-4" /> Affiliate Program
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Earn With{' '}
          <span className="text-gradient">Vitality</span>
        </h1>
        <p className="text-white/50 max-w-lg mx-auto text-lg">
          Share our products, earn 10% commission on every sale. Server-side tracking means every referral is counted.
        </p>
      </div>

      {/* Perks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
        {perks.map((p) => (
          <div key={p.title} className="glass rounded-2xl p-5 card-hover">
            <p.icon className="w-8 h-8 text-brand-400 mb-3" />
            <h3 className="font-semibold mb-1">{p.title}</h3>
            <p className="text-sm text-white/40">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Apply */}
      <div className="max-w-md mx-auto">
        <div className="glass rounded-2xl p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Application Submitted!</h2>
              <p className="text-white/50">We&apos;ll review your application and get back to you within 24 hours.</p>
            </div>
          ) : session ? (
            <>
              <h2 className="text-xl font-bold mb-6">Apply to Join</h2>
              <div className="space-y-4">
                <Input
                  label="PayPal Email (for payouts)"
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="paypal@example.com"
                />
                <Button onClick={handleApply} loading={loading} className="w-full" size="lg">
                  Submit Application
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-3">Ready to Join?</h2>
              <p className="text-white/50 mb-6">Create an account to apply to our affiliate program.</p>
              <div className="flex gap-3">
                <Link href="/auth/register" className="flex-1">
                  <Button className="w-full">Create Account</Button>
                </Link>
                <Link href="/auth/login" className="flex-1">
                  <Button variant="secondary" className="w-full">Sign In</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
