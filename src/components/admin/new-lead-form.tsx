'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LEAD_PRIORITIES, LEAD_SOURCES } from './lead-constants'
import { parseMoneyToCents } from '@/lib/money'

interface AdminInfo {
  id: string
  email: string
  name: string | null
}

export function NewLeadForm({ admins }: { admins: AdminInfo[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [source, setSource] = useState('website')
  const [priority, setPriority] = useState('NORMAL')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [probability, setProbability] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDue, setNextActionDue] = useState('')
  const [notes, setNotes] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!businessName || !contactName || !contactEmail) {
      setErr('Business name, contact name and email are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          contactName,
          contactEmail,
          contactPhone: contactPhone || null,
          source,
          priority,
          estimatedValue: estimatedValue
            ? (parseMoneyToCents(estimatedValue) ?? 0)
            : null,
          probability: probability ? parseInt(probability, 10) : null,
          assignedTo: assignedTo || null,
          nextAction: nextAction || null,
          nextActionDue: nextActionDue || null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErr(data?.error || 'Failed to create lead')
        return
      }
      const created = await res.json()
      router.push(`/admin/leads/${created.id}`)
      router.refresh()
    } catch {
      setErr('Failed to create lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass rounded-2xl p-6 space-y-4 max-w-3xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Business name *"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
        />
        <Input
          label="Contact name *"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          required
        />
        <Input
          label="Contact email *"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
        />
        <Input
          label="Contact phone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/70">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/70">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {LEAD_PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Estimated value (USD / month)"
          type="number"
          min="0"
          step="0.01"
          value={estimatedValue}
          onChange={(e) => setEstimatedValue(e.target.value)}
          placeholder="e.g. 500.00"
        />
        <Input
          label="Probability (0-100)"
          type="number"
          min="0"
          max="100"
          value={probability}
          onChange={(e) => setProbability(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/70">
            Assigned to
          </label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Unassigned</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Next action"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder="Call back Friday"
        />
        <Input
          label="Next action due"
          type="datetime-local"
          value={nextActionDue}
          onChange={(e) => setNextActionDue(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-white/70">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" loading={loading}>
          Create Lead
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/leads')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
