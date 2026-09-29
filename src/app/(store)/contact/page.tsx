'use client'

import { useState } from 'react'
import { Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          typeof data.error === 'string' ? data.error : 'Failed to send',
        )
      } else {
        setSent(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="glass rounded-2xl p-10 text-center">
          <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">We got your message</h1>
          <p className="text-white/60 mb-6">
            A real person will respond within one business day. Check your inbox
            for a confirmation.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-10">
        <Mail className="w-12 h-12 text-brand-400 mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">Contact Us</h1>
        <p className="text-white/50">
          Questions about a product, an order, or the research? Send us a note.
        </p>
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Name *"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email *"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <Input
          label="Subject *"
          required
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
        <div>
          <label className="text-sm font-medium text-white/70 mb-1.5 block">
            Message *
          </label>
          <textarea
            required
            rows={7}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm px-1">{error}</p>}

        <Button type="submit" loading={loading} size="lg" className="w-full">
          Send Message
        </Button>
      </form>
    </div>
  )
}
