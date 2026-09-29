'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface OrderOption {
  id: string
  orderNumber: string
}

export default function NewTicketPage() {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [orderId, setOrderId] = useState('')
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Best-effort: grab orders so customer can tag the ticket
    fetch('/api/orders')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setOrders(data)
      })
      .catch(() => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message,
          orderId: orderId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          typeof data.error === 'string' ? data.error : 'Failed to submit',
        )
      } else {
        router.push(`/account/support/${data.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/account/support"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Support Ticket</h1>
          <p className="text-white/40 text-sm mt-0.5">
            A real person will respond within one business day.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 max-w-2xl">
        <div className="glass rounded-2xl p-6 space-y-4">
          <Input
            label="Subject *"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your question"
          />

          {orders.length > 0 && (
            <div>
              <label className="text-sm font-medium text-white/70 mb-1.5 block">
                Related order (optional)
              </label>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">None</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">
              Message *
            </label>
            <textarea
              required
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's going on? Include as much detail as helpful."
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm px-1">{error}</p>}

        <Button type="submit" loading={loading} size="lg">
          Send Ticket
        </Button>
      </form>
    </div>
  )
}
