'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TurnstileWidget } from '@/components/store/turnstile-widget'

const ORG_TYPES = [
  { value: 'GYM', label: 'Gym / Fitness Studio' },
  { value: 'CLINIC', label: 'Clinic' },
  { value: 'DOCTOR_OFFICE', label: "Doctor's Office" },
  { value: 'OTHER', label: 'Other' },
] as const

export default function BusinessApplyPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const body = {
      businessName: form.get('businessName'),
      type: form.get('type'),
      contactName: form.get('contactName'),
      email: form.get('email'),
      phone: form.get('phone'),
      website: form.get('website'),
      reason: form.get('reason'),
      turnstileToken,
    }

    try {
      const res = await fetch('/api/business/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-10 max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-3">Application Received</h2>
          <p className="text-white/60 mb-6">
            Thank you for your interest in partnering with The Vitality Project.
            Our team will review your application and get back to you within 2-3 business days.
          </p>
          <a href="/" className="text-brand-400 hover:text-brand-300 text-sm font-medium">
            Return to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="glass rounded-2xl p-8 md:p-10 max-w-2xl w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Become a Partner</h1>
          <p className="text-white/50">
            Join The Vitality Project as a business partner. Place a kiosk in your
            location and earn commissions on every sale.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              name="businessName"
              label="Business Name"
              placeholder="Dr. Murphy's Wellness Clinic"
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-white/70">Business Type</label>
              <select
                name="type"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Select type...</option>
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              name="contactName"
              label="Contact Name"
              placeholder="John Murphy"
              required
            />
            <Input
              name="email"
              label="Email Address"
              type="email"
              placeholder="john@example.com"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              name="phone"
              label="Phone Number"
              type="tel"
              placeholder="(555) 123-4567"
              required
            />
            <Input
              name="website"
              label="Website (optional)"
              type="url"
              placeholder="https://drmurphy.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/70">
              Why do you want to partner with us?
            </label>
            <textarea
              name="reason"
              rows={4}
              required
              placeholder="Tell us about your business and why you'd like to offer our products to your clients..."
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Bot protection — invisible until Cloudflare flags suspicious
              traffic. No-ops in dev when NEXT_PUBLIC_TURNSTILE_SITE_KEY
              isn't set; the server side fails-open in that case too. */}
          <TurnstileWidget onToken={setTurnstileToken} onExpired={() => setTurnstileToken(null)} />

          <Button type="submit" size="lg" loading={loading} className="w-full">
            Submit Application
          </Button>
        </form>
      </div>
    </div>
  )
}
