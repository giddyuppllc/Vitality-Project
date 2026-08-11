'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Gift } from 'lucide-react'
import { parseMoneyToCents } from '@/lib/money'

export function GrantCreditsForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<'credit' | 'points'>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          kind,
          amount: kind === 'credit' ? (parseMoneyToCents(amount) ?? 0) : Math.floor(Number(amount)),
          reason,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to grant')
      setSuccess(
        kind === 'credit'
          ? `Granted $${amount} to ${email}`
          : `Granted ${amount} points to ${email}`
      )
      setEmail('')
      setAmount('')
      setReason('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-6 space-y-4 h-fit sticky top-6">
      <div className="flex items-center gap-3">
        <Gift className="w-5 h-5 text-brand-400" />
        <h2 className="font-semibold">Grant to Customer</h2>
      </div>

      <div>
        <p className="text-sm text-white/60 mb-2">Type</p>
        <div className="flex gap-2">
          <button
            onClick={() => setKind('credit')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm border transition-colors ${
              kind === 'credit'
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-white/10 text-white/50 hover:text-white'
            }`}
          >
            Store Credit
          </button>
          <button
            onClick={() => setKind('points')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm border transition-colors ${
              kind === 'points'
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-white/10 text-white/50 hover:text-white'
            }`}
          >
            Loyalty Points
          </button>
        </div>
      </div>

      <Input
        label="Customer Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="customer@example.com"
      />
      <Input
        label={kind === 'credit' ? 'Amount (USD)' : 'Points'}
        type="number"
        step={kind === 'credit' ? '0.01' : '1'}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div>
        <label className="text-sm font-medium text-white/70 mb-1.5 block">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Reason for the grant..."
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      <Button onClick={submit} loading={loading} disabled={loading || !email || !amount} className="w-full">
        Grant
      </Button>
    </div>
  )
}
